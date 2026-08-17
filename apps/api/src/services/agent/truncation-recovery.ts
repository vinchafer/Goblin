// TRUNC-2 — recovering an AGENT turn that the provider cut off at the output ceiling.
//
// The chat surface is where the first tester cohort hit this (see
// services/stream-continuation.ts), but the agent path is MORE exposed, not less: it
// writes whole files through `write_file`, so a big single-page build is exactly the
// shape that runs past 8096 output tokens — and the failure mode was worse than in chat.
//
// WHAT USED TO HAPPEN (before this module), both branches silent:
//   • Truncated mid-`write_file`: the tool_call arguments are half a JSON object, so
//     `JSON.parse` threw, `normalizeToolCalls` swallowed it into `args = {}`, and the
//     tool reported a missing-argument error. The model then rewrote the file FROM THE
//     TOP — the same restart the chat tester saw, just spending a build iteration on it.
//   • Truncated mid-prose with no tool call: the fallback protocol read it as "plain
//     prose, no call" and the loop landed on `outcome = 'finished'`. A run cut off
//     mid-thought was reported as a finished run. That is the honesty defect, not just
//     an efficiency one.
//
// WHAT HAPPENS NOW: the finish reason is read (`model-turn.ts`), and this module
// CONTINUES the turn — plain-text continuation rounds that resume exactly where the
// output stopped, stitched with the same byte-exact joint logic as the chat path. A
// half-written `write_file` is completed and then executed once, whole. When the round
// cap is spent, the run fails HONESTLY — it never presents a cut-off turn as a finished
// one, and never writes a half file as if it were the whole file.
//
// CONSUMPTION: a continuation round is a full model turn, billed through the same
// `bill()` the loop already applies to every turn. Ledger row M17.

import { stitch, OVERLAP_WINDOW } from '../stream-continuation';
import type { AgentModel, AgentMessage, ModelTurn, ToolCall, ToolSpec } from './types';

/**
 * How many extra model turns one truncated agent turn may cost. Bounded for the same
 * reason as the chat path: a cap that can be reached is a cap that must be reported.
 * Env knob: `AGENT_MAX_CONTINUATION_ROUNDS` (0 disables recovery — a truncated turn then
 * fails honestly on the spot).
 */
export function agentMaxContinuationRounds(): number {
  const raw = Number(process.env.AGENT_MAX_CONTINUATION_ROUNDS);
  if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  return 3;
}

// ─── salvaging a half-written tool call ────────────────────────────────────────

export interface SalvagedCall {
  /** Argument values that arrived complete (e.g. `path`, which precedes `content`). */
  complete: Record<string, string>;
  /** The argument whose string value was still being written when the output stopped. */
  partialKey: string | null;
  /** That argument's value as far as it got, with JSON escapes already decoded. */
  partialValue: string;
}

/**
 * Read as much as possible out of a tool call's truncated argument JSON.
 *
 * `write_file` is the case that matters and its shape is friendly: the provider emits
 * `{"path": "index.html", "content": "<!doctype html>…` — the path is long complete
 * before the content runs out. A strict parser gets nothing from that; this one gets the
 * path and every byte of content that arrived.
 *
 * Deliberately handles only JSON's string form (that is what these tools take) and
 * decodes escapes itself, because the input is by definition not valid JSON.
 */
export function salvagePartialArgs(raw: string): SalvagedCall {
  const complete: Record<string, string> = {};
  let partialKey: string | null = null;
  let partialValue = '';

  let i = 0;
  const n = raw.length;

  /** Read a JSON string starting AT its opening quote. Returns null if it never closes. */
  const readString = (start: number): { value: string; end: number } | { value: string; end: null } => {
    let out = '';
    let j = start + 1;
    while (j < n) {
      const ch = raw[j]!;
      if (ch === '\\') {
        const esc = raw[j + 1];
        if (esc === undefined) return { value: out, end: null }; // cut inside an escape
        switch (esc) {
          case 'n': out += '\n'; break;
          case 't': out += '\t'; break;
          case 'r': out += '\r'; break;
          case 'b': out += '\b'; break;
          case 'f': out += '\f'; break;
          case '"': out += '"'; break;
          case '\\': out += '\\'; break;
          case '/': out += '/'; break;
          case 'u': {
            const hex = raw.slice(j + 2, j + 6);
            if (hex.length < 4) return { value: out, end: null }; // cut inside \uXXXX
            out += String.fromCharCode(parseInt(hex, 16));
            j += 4;
            break;
          }
          default: out += esc;
        }
        j += 2;
        continue;
      }
      if (ch === '"') return { value: out, end: j };
      out += ch;
      j += 1;
    }
    return { value: out, end: null }; // ran out mid-string — this is the partial one
  };

  while (i < n) {
    // Find the next key.
    while (i < n && raw[i] !== '"') i += 1;
    if (i >= n) break;
    const key = readString(i);
    if (key.end === null) break; // truncated inside a KEY — nothing usable follows
    i = key.end + 1;

    // Skip to the value.
    while (i < n && raw[i] !== ':') i += 1;
    i += 1;
    while (i < n && /\s/.test(raw[i]!)) i += 1;
    if (i >= n) break;

    if (raw[i] !== '"') {
      // A non-string value (number/bool/null/object). Not a shape these tools use for
      // the long argument; skip it rather than guess.
      while (i < n && raw[i] !== ',' && raw[i] !== '}') i += 1;
      i += 1;
      continue;
    }

    const value = readString(i);
    if (value.end === null) {
      partialKey = key.value;
      partialValue = value.value;
      break;
    }
    complete[key.value] = value.value;
    i = value.end + 1;
  }

  return { complete, partialKey, partialValue };
}

// ─── continuation prompts ──────────────────────────────────────────────────────

/**
 * Resume a half-written FILE. The reply must be raw file bytes and nothing else — no
 * tool call (the arguments are being assembled server-side), no markdown fence (it would
 * land inside the file), no preamble.
 */
export function buildFileContinuationPrompt(path: string, partial: string): string {
  return (
    `Du hast begonnen, die Datei \`${path}\` zu schreiben, aber deine Ausgabe wurde am ` +
    'Limit abgeschnitten — mitten im Dateiinhalt.\n' +
    'ABSOLUTE REGELN für diese Antwort:\n' +
    '1. Gib AUSSCHLIESSLICH den weiteren Dateiinhalt aus, ab dem nächsten Zeichen.\n' +
    '2. KEIN Werkzeug-Aufruf, KEIN ```-Codeblock, KEINE Einleitung, KEIN Kommentar.\n' +
    '3. Fange NICHT von vorn an und wiederhole nichts.\n' +
    '4. Schreibe die Datei zu Ende und höre dann auf.\n\n' +
    'Das Ende des bisherigen Inhalts lautet wörtlich:\n' +
    '--- ENDE BISHER ---\n' +
    partial.slice(-OVERLAP_WINDOW) +
    '\n--- ENDE BISHER ---'
  );
}

/** Resume a cut-off narration/report turn (no tool call was involved). */
export function buildTextContinuationPrompt(partial: string): string {
  return (
    'Deine letzte Antwort wurde am Ausgabe-Limit abgeschnitten — sie endet mitten im Text.\n' +
    'ABSOLUTE REGELN für diese Antwort:\n' +
    '1. Setze GENAU an dieser Stelle fort, ab dem nächsten Zeichen.\n' +
    '2. Fange NICHT von vorn an, wiederhole nichts, keine Einleitung.\n' +
    '3. KEIN Werkzeug-Aufruf in dieser Antwort — nur der weitere Text.\n\n' +
    'Das Ende deiner bisherigen Antwort lautet wörtlich:\n' +
    '--- ENDE BISHER ---\n' +
    partial.slice(-OVERLAP_WINDOW) +
    '\n--- ENDE BISHER ---'
  );
}

// ─── the recovery itself ───────────────────────────────────────────────────────

export type RecoveryResult =
  /** The turn was completed; use these in place of the truncated turn's. */
  | { kind: 'recovered'; content: string; toolCalls: ToolCall[]; rounds: number }
  /** The round cap ran out, or nothing usable could be salvaged. Fail honestly. */
  | { kind: 'exhausted'; rounds: number; reason: 'cap' | 'unsalvageable' };

export interface RecoverInput {
  model: AgentModel;
  /** History as it stood BEFORE the truncated turn (the truncated assistant message is
   *  deliberately NOT included: a half-written native tool_call cannot be round-tripped
   *  without its matching tool result, and the provider rejects that pairing). */
  messages: AgentMessage[];
  turn: ModelTurn;
  tools: ToolSpec[];
  signal?: AbortSignal;
  maxRounds?: number;
  /** Called once per continuation turn so the loop can bill and budget it. */
  onRound?: (usage: { inputTokens: number; outputTokens: number }) => Promise<void> | void;
}

/**
 * Continue a truncated agent turn until it completes or the round cap is spent.
 *
 * Two shapes, one mechanism:
 *  • a half-written `write_file`-style call → the long string argument is continued and
 *    the call is rebuilt whole, so the file is written ONCE, complete;
 *  • a cut-off text turn → the text is continued and stitched.
 */
export async function recoverTruncatedTurn(input: RecoverInput): Promise<RecoveryResult> {
  const maxRounds = input.maxRounds ?? agentMaxContinuationRounds();
  const partialCall = input.turn.partialToolCall;

  if (partialCall) {
    const salvaged = salvagePartialArgs(partialCall.rawArguments);
    // Nothing to build on — no argument survived the cut. Continuing would mean
    // inventing the call, so this fails honestly instead.
    if (!salvaged.partialKey || Object.keys(salvaged.complete).length === 0) {
      return { kind: 'exhausted', rounds: 0, reason: 'unsalvageable' };
    }
    const label = salvaged.complete.path ?? salvaged.complete.file ?? partialCall.name;
    const completed = await continueString({
      input,
      maxRounds,
      partial: salvaged.partialValue,
      prompt: (sofar) => buildFileContinuationPrompt(label, sofar),
    });
    if (completed === null) return { kind: 'exhausted', rounds: maxRounds, reason: 'cap' };

    return {
      kind: 'recovered',
      content: input.turn.content,
      toolCalls: [{
        id: partialCall.id,
        name: partialCall.name,
        args: { ...salvaged.complete, [salvaged.partialKey]: completed.text },
      }],
      rounds: completed.rounds,
    };
  }

  // Text-only truncation: the turn was thinking out loud and ran out of room.
  const completed = await continueString({
    input,
    maxRounds,
    partial: input.turn.content,
    prompt: (sofar) => buildTextContinuationPrompt(sofar),
  });
  if (completed === null) return { kind: 'exhausted', rounds: maxRounds, reason: 'cap' };

  return {
    kind: 'recovered',
    content: completed.text,
    toolCalls: input.turn.toolCalls,
    rounds: completed.rounds,
  };
}

/**
 * Run continuation turns until the model finishes without truncation. Returns null when
 * the cap is spent — the caller must then degrade honestly, never ship the fragment.
 * Continuation turns are run WITHOUT tools so the reply is plain text (see the prompts).
 */
async function continueString(args: {
  input: RecoverInput;
  maxRounds: number;
  partial: string;
  prompt: (sofar: string) => string;
}): Promise<{ text: string; rounds: number } | null> {
  const { input, maxRounds } = args;
  let text = args.partial;

  for (let round = 1; round <= maxRounds; round++) {
    const turn = await input.model.turn({
      messages: [...input.messages, { role: 'user', content: args.prompt(text) }],
      tools: [],
      signal: input.signal,
    });
    await input.onRound?.(turn.usage);

    // A continuation that produced nothing cannot be continued further — stop rather
    // than spend the remaining rounds on the same empty answer.
    if (!turn.content) return null;

    text = stitch(text, turn.content);
    if (!turn.truncated) return { text, rounds: round };
  }

  return null;
}
