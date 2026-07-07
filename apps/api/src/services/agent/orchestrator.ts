// FEEL-3a — the agent orchestrator loop (A2 core, spec §2).
//
//   user message → model turn (system + context + tools)
//     → tool_call(s)? execute server-side → tool_result → next turn
//     → finish? → final report
//   loop until: finish | iteration cap | unit budget | user stop | fatal error
//
// Honesty invariants are MECHANICS here, not prompt hopes (spec §5):
//  • The report is assembled from tool RESULTS (files/classification), never model claims.
//  • Budget breach forces a truthful finish ("Budget erreicht — Stand: …").
//  • Stop ends the loop after the in-flight tool completes; partial state persists.
//  • finish is intercepted by the loop (control-flow tool — needs no service).
//
// The loop is transport-/DB-agnostic: model, tool executor, billing, and the event
// sink are all injected, so it runs deterministically under unit test.

import { trackCompletion } from '../../lib/track-completion';
import { runWeightedUnits, agentMaxIterations, agentMaxUnits } from './config';
import { parseFallbackToolCall, buildRepairInstruction } from './protocol';
import { getAgentModel } from './model-turn';
import type { GoblinTierId } from '../goblin-hosted';
import type {
  AgentModel,
  AgentMessage,
  ToolSpec,
  ToolCall,
  ToolExecutor,
  ToolResult,
  ReportFile,
  ReportCard,
  RunOutcome,
  RunResult,
  EmitEvent,
} from './types';

/** Injected biller — one call per model turn. Defaults to trackCompletion. */
export type BillTurn = (usage: { inputTokens: number; outputTokens: number }) => Promise<void> | void;

/**
 * FEEL-3b B3: bounded self-heal (spec §5.3). A red publish gate or a failed tool feeds
 * the error to the model verbatim; the model may run at most this many CORRECTIVE cycles,
 * each narrated. On the last cycle the loop forces an honest finish — never a silent
 * retry, never an infinite loop.
 */
const MAX_HEAL_CYCLES = 2;

/**
 * The single repair reprompt after a mixed-mode turn (a native call + a fenced
 * `tool_call`, or several calls in one turn). One tool-call signal per turn is the
 * contract; the extra call would otherwise be dropped silently.
 */
const MIXED_MODE_REPAIR =
  'Deine letzte Antwort enthielt MEHR ALS EINEN Werkzeug-Aufruf (z.B. einen nativen ' +
  'Function-Call UND einen umzäunten `tool_call`-Block, oder mehrere Aufrufe). Rufe pro ' +
  'Antwort GENAU EIN Werkzeug auf — nutze NUR das native Function-Call-Format, ohne ' +
  'zusätzlichen `tool_call`-Block und ohne zweiten Aufruf. Wiederhole jetzt den EINEN ' +
  'Aufruf, den du als Nächstes ausführen willst.';

/** The narrated corrective line for a failed tool result (spec §5.3 tone). */
function healNarration(tool: string, result: ToolResult): string {
  const detail = result.error?.message || result.summary || 'unbekannter Fehler';
  if (tool === 'publish') return `Prüfung fehlgeschlagen: ${detail} — ich korrigiere das und versuche es erneut.`;
  return `${tool} meldete einen Fehler: ${detail} — ich versuche es korrigiert.`;
}

/** The honest failure reason after the heal budget is spent (what was tried + the state). */
function healFailureReason(result: ToolResult): string {
  const detail = result.error?.message || result.summary || 'unbekannter Fehler';
  return `Nach ${MAX_HEAL_CYCLES} Korrekturversuchen weiterhin fehlgeschlagen: ${detail}`;
}

export interface RunAgentInput {
  runId: string | null;
  userId: string;
  projectId: string;
  sessionId: string;
  modelSlug: GoblinTierId;
  systemPrompt: string;
  userMessage: string;
  history?: AgentMessage[];
  tools: ToolSpec[];
  executor: ToolExecutor;
  emit: EmitEvent;
  stopSignal?: AbortSignal;
  /**
   * FEEL-3b D1: is `publish` allowed this run? Set by the route from explicit publish
   * intent (classifyPublishIntent) or a confirmation-chip tap. When false, a `publish`
   * call is denied by the orchestrator (never reaches the deploy) and the run lands as a
   * saved draft carrying the confirmation chip. Per-run, never sticky.
   */
  publishGranted?: boolean;
  /** Test seams — default to the real model / budgets / biller. */
  model?: AgentModel;
  maxIterations?: number;
  maxUnits?: number;
  bill?: BillTurn;
}

/** Short, content-free summary of a call's args for the step log (never dumps file bodies). */
function argSummary(call: ToolCall): string {
  const path = call.args?.path;
  if (typeof path === 'string' && path) return path;
  const keys = Object.keys(call.args ?? {}).filter((k) => k !== 'content');
  return keys.length ? keys.map((k) => `${k}=${String(call.args[k]).slice(0, 40)}`).join(' ') : '';
}

/** Compact result fed back to the model (includes data so read_file content reaches it). */
function resultForModel(result: ToolResult): string {
  return JSON.stringify({
    ok: result.ok,
    summary: result.summary,
    ...(result.error ? { error: result.error } : {}),
    ...(result.data !== undefined ? { data: result.data } : {}),
  });
}

/** Append a tool result to history — native tool role when supported, else a labeled user turn. */
function toolResultMessage(call: ToolCall, result: ToolResult, native: boolean): AgentMessage {
  const body = resultForModel(result);
  if (native) return { role: 'tool', toolCallId: call.id, name: call.name, content: body };
  return { role: 'user', content: `TOOL_RESULT ${call.name}: ${body}` };
}

/**
 * Default biller: routes each turn through completion tracking with the run_id so the
 * report's cost line sums the run's real completions. Mirrors the router's goblin-hosted
 * attribution (provider/source_tier = goblin_hosted; model = the Goblin tier slug).
 */
function defaultBill(input: RunAgentInput): BillTurn {
  return async ({ inputTokens, outputTokens }) => {
    await trackCompletion({
      userId: input.userId,
      projectId: input.projectId,
      provider: 'goblin_hosted',
      model: input.modelSlug,
      sourceTier: 'goblin_hosted',
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      runId: input.runId,
    });
  };
}

/** Assemble the final report from ground truth (files map + saved flag), quoting model text. */
function assembleReport(
  outcome: RunOutcome,
  files: ReportFile[],
  savedDraft: boolean,
  units: number,
  modelText: string,
  publishedUrl: string | undefined,
  failureReason?: string,
): ReportCard {
  let state: ReportCard['state'];
  if (outcome === 'stopped') state = 'stopped';
  else if (outcome === 'error') state = 'failed';
  else if (publishedUrl) state = 'published';
  else state = savedDraft ? 'draft-saved' : 'draft-unsaved';

  const followUps: ReportCard['followUps'] = [];
  if (publishedUrl) {
    // Verified live — open the attested URL; still let the user inspect the diff.
    followUps.push('open');
    if (files.length > 0) followUps.push('view-changes');
  } else {
    if (files.length > 0) followUps.push('view-changes');
    // A saved-but-unpublished draft carries the D1 confirmation chip (one tap → publish).
    if (savedDraft && (outcome === 'finished' || outcome === 'stopped')) followUps.push('confirm-publish');
  }

  return { outcome, state, files, unitsConsumed: units, modelText, followUps, publishedUrl, failureReason };
}

/**
 * Run the agent loop to completion. Never throws — a fatal model/tool error becomes an
 * honest `error` outcome with a failure report. Returns everything the route needs to
 * persist (run-store.finalizeAgentRun) and to emit the final report frame.
 */
export async function runAgent(input: RunAgentInput): Promise<RunResult> {
  const model = input.model ?? getAgentModel(input.modelSlug);
  const bill = input.bill ?? defaultBill(input);
  const maxIter = input.maxIterations ?? agentMaxIterations();
  const maxUnits = input.maxUnits ?? agentMaxUnits();
  const stop = input.stopSignal;

  const messages: AgentMessage[] = [
    { role: 'system', content: input.systemPrompt },
    ...(input.history ?? []),
    { role: 'user', content: input.userMessage },
  ];

  const steps: RunResult['steps'] = [];
  const toolsUsed = new Set<string>();
  const files = new Map<string, ReportFile>();
  let savedDraft = false;
  let publishedUrl: string | undefined;
  const publishGranted = input.publishGranted === true;
  let tokensIn = 0;
  let tokensOut = 0;
  let units = 0;
  let iterations = 0;
  let repairsUsed = 0;
  let mixedRepairsUsed = 0;
  let healCycles = 0;
  let modelText = '';
  let outcome: RunOutcome | null = null;
  let failureReason: string | undefined;

  while (iterations < maxIter) {
    if (stop?.aborted) { outcome = 'stopped'; break; }
    if (units >= maxUnits) { outcome = 'budget'; break; }
    iterations += 1;

    let turn;
    try {
      turn = await model.turn({ messages, tools: input.tools, signal: stop });
    } catch (e) {
      if (stop?.aborted) { outcome = 'stopped'; break; }
      outcome = 'error';
      failureReason = e instanceof Error ? e.message : 'Modellfehler';
      break;
    }

    tokensIn += turn.usage.inputTokens;
    tokensOut += turn.usage.outputTokens;
    units = runWeightedUnits(input.modelSlug, tokensIn, tokensOut);
    await bill(turn.usage);

    if (turn.content.trim()) {
      modelText = turn.content;
      await input.emit({ type: 'agent_narration', text: turn.content });
    }
    messages.push({ role: 'assistant', content: turn.content, raw: turn.assistantMessage });

    // Resolve tool calls: native first, JSON fallback on the text when native is empty.
    const nativeCalls = turn.toolCalls;
    const parsed = parseFallbackToolCall(turn.content);
    const fencePresent = parsed.kind !== 'none';

    // Mixed-mode guard (founder D-fix, B5 flake): exactly ONE tool-call signal per turn.
    // The Swift model occasionally emits a native call AND a fenced `tool_call` in prose
    // (or several native calls) in one turn — the extra call is then silently dropped,
    // which is how W10 obs-1 lost index.html. Reject the turn with one repair-reprompt;
    // a second violation is an honest abort. Never silently execute a subset.
    if (nativeCalls.length + (fencePresent ? 1 : 0) > 1) {
      if (mixedRepairsUsed < 1) {
        mixedRepairsUsed += 1;
        messages.push({ role: 'system', content: MIXED_MODE_REPAIR });
        continue;
      }
      outcome = 'error';
      failureReason = 'Mehrere Tool-Aufrufe in einem Turn (nach Reparaturversuch)';
      break;
    }

    let calls: ToolCall[];
    if (nativeCalls.length === 1) {
      calls = nativeCalls;
    } else {
      // No native call — resolve via the strict JSON fallback protocol.
      if (parsed.kind === 'call') {
        calls = [parsed.call];
      } else if (parsed.kind === 'malformed') {
        if (repairsUsed < 1) {
          repairsUsed += 1;
          // C1: quote the exact schema/parse violation so the model fixes THAT mistake.
          messages.push({ role: 'system', content: buildRepairInstruction(parsed.detail) });
          continue; // exactly one repair reprompt, then honest abort
        }
        outcome = 'error';
        failureReason =
          'Der Entwurf konnte nicht sauber gelesen werden — das Modell hat auch nach einem ' +
          'Hinweis kein gültiges Werkzeug-Format geliefert. Ich habe nichts verändert.';
        break;
      } else {
        // 'none' — plain prose, no tool call. The model answered (refusal / wrap-up).
        // Honest implicit finish: no fabricated action.
        outcome = 'finished';
        break;
      }
    }

    let terminated = false;
    for (const call of calls) {
      if (call.name === 'finish') {
        const rep = typeof call.args?.report === 'string' ? call.args.report : '';
        if (rep) modelText = rep;
        outcome = 'finished';
        terminated = true;
        break;
      }

      // FEEL-3b D1: publish is orchestrator-gated. Without an intent grant it never
      // reaches the deploy — the model gets a structured denial and must save + finish;
      // the run then lands as a saved draft carrying the confirmation chip.
      if (call.name === 'publish' && !publishGranted) {
        const denial: ToolResult = {
          ok: false,
          summary: 'Veröffentlichen braucht deine Freigabe',
          error: {
            code: 'intent_required',
            message:
              'Der Nutzer hat das Veröffentlichen in DIESER Nachricht nicht ausdrücklich verlangt. ' +
              'Veröffentliche NICHT. Sichere den Entwurf mit save_draft und schließe mit finish ab — ' +
              'die Plattform bietet dem Nutzer danach einen Bestätigungs-Chip zum Veröffentlichen an.',
          },
        };
        toolsUsed.add('publish');
        steps.push({ tool: 'publish', args: '', outcome: 'intent_required', ms: 0 });
        await input.emit({ type: 'agent_step', tool: 'publish', summary: denial.summary, ok: false, ms: 0 });
        messages.push(toolResultMessage(call, denial, model.supportsNativeTools));
        continue; // next call/turn — NOT counted as a failure/heal cycle
      }

      const t0 = Date.now();
      let result: ToolResult;
      try {
        result = await input.executor(call, {
          userId: input.userId,
          projectId: input.projectId,
          sessionId: input.sessionId,
          // Deploy/verify sub-progress ("wird geprüft 3/6") flows into the narration feed.
          emitProgress: (msg) => input.emit({ type: 'agent_narration', text: msg }),
        });
      } catch (e) {
        result = {
          ok: false,
          summary: 'Werkzeugfehler',
          error: { code: 'tool_threw', message: e instanceof Error ? e.message : 'unbekannt' },
        };
      }
      const ms = Date.now() - t0;

      toolsUsed.add(call.name);
      steps.push({
        tool: call.name,
        args: argSummary(call),
        outcome: result.ok ? 'ok' : result.error?.code ?? 'error',
        ms,
      });
      await input.emit({ type: 'agent_step', tool: call.name, summary: result.summary, ok: result.ok, ms });

      if (result.file) files.set(result.file.path, result.file);
      if (call.name === 'save_draft' && result.ok) savedDraft = true;
      // A green publish attests a verified live URL — the report's ground truth for §5.1.
      if (call.name === 'publish' && result.ok) {
        const url = (result.data as { url?: string } | undefined)?.url;
        if (typeof url === 'string' && url) { publishedUrl = url; savedDraft = true; }
      }

      messages.push(toolResultMessage(call, result, model.supportsNativeTools));

      if (stop?.aborted) { outcome = 'stopped'; terminated = true; break; }

      // B3 self-heal: a failed tool (incl. a red publish gate) is narrated and counted.
      // The model gets the error verbatim (in the tool result above) and may correct — but
      // only MAX_HEAL_CYCLES times. On the last cycle we force an honest finish. A benign
      // not-found during orientation (read_file/list_files) is NOT a corrective cycle —
      // that's the FEEL-3a same-tool retry path, so it never burns the heal budget.
      const isOrientationMiss =
        (call.name === 'read_file' || call.name === 'list_files') && result.error?.code === 'not_found';
      if (!result.ok && !isOrientationMiss) {
        healCycles += 1;
        await input.emit({ type: 'agent_narration', text: healNarration(call.name, result) });
        if (healCycles >= MAX_HEAL_CYCLES) {
          outcome = 'error';
          failureReason = healFailureReason(result);
          modelText = modelText || failureReason;
          terminated = true;
          break;
        }
      }
    }

    if (terminated) break;
  }

  // Exhausted the iteration budget without a finish → truthful budget landing.
  if (outcome === null) outcome = 'budget';

  const fileList = [...files.values()];
  const report = assembleReport(outcome, fileList, savedDraft, units, modelText, publishedUrl, failureReason);
  const status: RunResult['status'] = outcome === 'error' ? 'failed' : 'success';

  await input.emit({ type: 'agent_report', report });

  return {
    outcome,
    status,
    report,
    steps,
    toolsUsed: [...toolsUsed],
    iterations,
    healCycles,
    tokensIn,
    tokensOut,
    unitsConsumed: units,
  };
}
