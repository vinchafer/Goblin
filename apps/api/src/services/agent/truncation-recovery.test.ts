// TRUNC-2 gate — the agent build path's exposure to the output ceiling.
//
// The tester hit this in CHAT, but the agent writes whole files through `write_file`, so
// it runs past 8096 output tokens sooner. Two silent failures existed here and both are
// asserted closed below:
//   1. a `write_file` cut in half → unparseable arguments → the tool reported a missing
//      argument and the model rewrote the file FROM THE TOP;
//   2. cut-off prose with no tool call → read as "the model is done" → `finished`.

import { describe, it, expect, vi } from 'vitest';
import {
  salvagePartialArgs,
  recoverTruncatedTurn,
  buildFileContinuationPrompt,
  buildTextContinuationPrompt,
  agentMaxContinuationRounds,
} from './truncation-recovery';
import { runAgent } from './orchestrator';
import type { AgentModel, ModelTurn, ToolExecutor, ToolResult, ToolSpec, EmitEvent, AgentEvent } from './types';

// ─── salvaging the half-written call ───────────────────────────────────────────

describe('salvagePartialArgs', () => {
  it('recovers the path and every byte of content from a cut-off write_file', () => {
    const raw = '{"path": "index.html", "content": "<!doctype html>\\n<html>\\n  <body>';
    const s = salvagePartialArgs(raw);

    expect(s.complete.path).toBe('index.html');
    expect(s.partialKey).toBe('content');
    expect(s.partialValue).toBe('<!doctype html>\n<html>\n  <body>'); // escapes decoded
  });

  it('decodes the escapes a strict parser never gets to see', () => {
    const raw = '{"path":"a.js","content":"const s = \\"x\\";\\n\\tif (a) {\\u00e4';
    const s = salvagePartialArgs(raw);
    expect(s.partialValue).toBe('const s = "x";\n\tif (a) {ä');
  });

  it('survives a cut inside an escape sequence without inventing a character', () => {
    const s = salvagePartialArgs('{"path":"a.txt","content":"line one\\');
    expect(s.complete.path).toBe('a.txt');
    expect(s.partialValue).toBe('line one');
  });

  it('survives a cut inside a \\u escape', () => {
    const s = salvagePartialArgs('{"path":"a.txt","content":"x\\u00');
    expect(s.partialValue).toBe('x');
  });

  it('reports nothing partial when the JSON happens to be complete', () => {
    const s = salvagePartialArgs('{"path":"a.txt","content":"done"}');
    expect(s.complete).toEqual({ path: 'a.txt', content: 'done' });
    expect(s.partialKey).toBeNull();
  });

  it('yields nothing usable when the cut landed before any value', () => {
    const s = salvagePartialArgs('{"pa');
    expect(s.complete).toEqual({});
    expect(s.partialKey).toBeNull();
  });

  it('skips non-string arguments rather than guessing at them', () => {
    const s = salvagePartialArgs('{"replace_all": true, "path": "a.txt", "content": "half');
    expect(s.complete.path).toBe('a.txt');
    expect(s.partialValue).toBe('half');
  });
});

// ─── recovery ──────────────────────────────────────────────────────────────────

const NO_TOOLS: ToolSpec[] = [];

/** A model that replays scripted turns and records what it was asked. */
function scripted(turns: ModelTurn[]) {
  const seen: Array<{ messages: unknown[]; tools: ToolSpec[] }> = [];
  let i = 0;
  const model: AgentModel = {
    supportsNativeTools: true,
    async turn({ messages, tools }) {
      seen.push({ messages: [...messages], tools });
      const t = turns[Math.min(i, turns.length - 1)]!;
      i += 1;
      return t;
    },
  };
  return { model, seen };
}

const usage = { inputTokens: 100, outputTokens: 8096 };

describe('recoverTruncatedTurn — a half-written file', () => {
  const WHOLE = '<!doctype html>\n<html>\n<body>\n<h1>Portfolio</h1>\n</body>\n</html>\n';
  const CUT = 24;

  it('completes the file and rebuilds ONE whole write_file call', async () => {
    const { model, seen } = scripted([
      { content: '', toolCalls: [], usage, truncated: false },
    ]);
    // The continuation returns the remainder of the file.
    const rest = WHOLE.slice(CUT);
    const { model: m2 } = scripted([{ content: rest, toolCalls: [], usage, truncated: false }]);

    const result = await recoverTruncatedTurn({
      model: m2,
      messages: [{ role: 'user', content: 'Baue eine Portfolioseite' }],
      turn: {
        content: 'Ich schreibe index.html',
        toolCalls: [{ id: 'c1', name: 'write_file', args: {} }],
        usage,
        truncated: true,
        partialToolCall: {
          id: 'c1',
          name: 'write_file',
          rawArguments: JSON.stringify({ path: 'index.html', content: WHOLE.slice(0, CUT) }).slice(0, -2),
        },
      },
      tools: NO_TOOLS,
    });

    expect(result.kind).toBe('recovered');
    if (result.kind !== 'recovered') return;
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.name).toBe('write_file');
    expect(result.toolCalls[0]!.args.path).toBe('index.html');
    // Byte-exact: the file that gets written is the file the model meant to write.
    expect(result.toolCalls[0]!.args.content).toBe(WHOLE);
    expect(seen).toHaveLength(0); // the first scripted model was unused — sanity
  });

  it('removes a re-emitted overlap at the joint', async () => {
    const { model } = scripted([
      // The model restates the last 14 characters before continuing.
      { content: WHOLE.slice(CUT - 14), toolCalls: [], usage, truncated: false },
    ]);

    const result = await recoverTruncatedTurn({
      model,
      messages: [],
      turn: {
        content: '',
        toolCalls: [],
        usage,
        truncated: true,
        partialToolCall: {
          id: 'c1', name: 'write_file',
          rawArguments: `{"path":"index.html","content":"${WHOLE.slice(0, CUT).replace(/\n/g, '\\n')}`,
        },
      },
      tools: NO_TOOLS,
    });

    expect(result.kind).toBe('recovered');
    if (result.kind !== 'recovered') return;
    expect(result.toolCalls[0]!.args.content).toBe(WHOLE);
  });

  it('asks for raw file bytes only — no tools, no fence, no preamble', async () => {
    const { model, seen } = scripted([{ content: 'rest', toolCalls: [], usage, truncated: false }]);

    await recoverTruncatedTurn({
      model,
      messages: [{ role: 'system', content: 'SYS' }],
      turn: {
        content: '', toolCalls: [], usage, truncated: true,
        partialToolCall: { id: 'c1', name: 'write_file', rawArguments: '{"path":"a.html","content":"<h1>' },
      },
      tools: [{ name: 'write_file', description: '', parameters: {} }],
    });

    expect(seen[0]!.tools).toEqual([]); // a continuation turn carries NO tools
    const last = seen[0]!.messages.at(-1) as { role: string; content: string };
    expect(last.role).toBe('user');
    expect(last.content).toContain('a.html');
    expect(last.content).toContain('KEIN Werkzeug-Aufruf');
    expect(last.content).toContain('<h1>'); // the anchor
  });

  it('runs several rounds when the continuation is itself truncated', async () => {
    let call = 0;
    const model: AgentModel = {
      supportsNativeTools: true,
      async turn() {
        call += 1;
        if (call === 1) return { content: 'BBB', toolCalls: [], usage, truncated: true };
        return { content: 'CCC', toolCalls: [], usage, truncated: false };
      },
    };

    const billed: number[] = [];
    const result = await recoverTruncatedTurn({
      model,
      messages: [],
      turn: {
        content: '', toolCalls: [], usage, truncated: true,
        partialToolCall: { id: 'c1', name: 'write_file', rawArguments: '{"path":"a.txt","content":"AAA' },
      },
      tools: NO_TOOLS,
      onRound: (u) => { billed.push(u.outputTokens); },
    });

    expect(result.kind).toBe('recovered');
    if (result.kind !== 'recovered') return;
    expect(result.toolCalls[0]!.args.content).toBe('AAABBBCCC');
    expect(result.rounds).toBe(2);
    // Every continuation round is a real model turn and is billed as one.
    expect(billed).toEqual([8096, 8096]);
  });

  it('CAP REACHED: gives up honestly instead of writing the fragment as the file', async () => {
    const model: AgentModel = {
      supportsNativeTools: true,
      async turn() { return { content: 'more', toolCalls: [], usage, truncated: true }; },
    };

    const result = await recoverTruncatedTurn({
      model,
      messages: [],
      turn: {
        content: '', toolCalls: [], usage, truncated: true,
        partialToolCall: { id: 'c1', name: 'write_file', rawArguments: '{"path":"a.txt","content":"AAA' },
      },
      tools: NO_TOOLS,
      maxRounds: 2,
    });

    expect(result).toEqual({ kind: 'exhausted', rounds: 2, reason: 'cap' });
  });

  it('refuses to guess when nothing survived the cut', async () => {
    const model: AgentModel = {
      supportsNativeTools: true,
      async turn() { throw new Error('must not be called'); },
    };

    const result = await recoverTruncatedTurn({
      model,
      messages: [],
      turn: {
        content: '', toolCalls: [], usage, truncated: true,
        partialToolCall: { id: 'c1', name: 'write_file', rawArguments: '{"pa' },
      },
      tools: NO_TOOLS,
    });

    expect(result).toEqual({ kind: 'exhausted', rounds: 0, reason: 'unsalvageable' });
  });
});

describe('recoverTruncatedTurn — cut-off prose', () => {
  it('continues the text instead of letting a half thought read as a finished one', async () => {
    const { model, seen } = scripted([
      { content: ' und schließe damit ab.', toolCalls: [], usage, truncated: false },
    ]);

    const result = await recoverTruncatedTurn({
      model,
      messages: [{ role: 'user', content: 'Bau was' }],
      turn: { content: 'Ich habe die Seite gebaut', toolCalls: [], usage, truncated: true },
      tools: NO_TOOLS,
    });

    expect(result.kind).toBe('recovered');
    if (result.kind !== 'recovered') return;
    expect(result.content).toBe('Ich habe die Seite gebaut und schließe damit ab.');
    const last = seen[0]!.messages.at(-1) as { content: string };
    expect(last.content).toContain('Setze GENAU an dieser Stelle fort');
  });
});

describe('prompts', () => {
  it('the file prompt forbids the fence that would end up inside the file', () => {
    const p = buildFileContinuationPrompt('src/App.tsx', 'export default function App() {');
    expect(p).toContain('src/App.tsx');
    expect(p).toContain('KEIN ```-Codeblock');
    expect(p).toContain('Fange NICHT von vorn an');
  });

  it('the text prompt forbids a tool call in the continuation', () => {
    expect(buildTextContinuationPrompt('halb')).toContain('KEIN Werkzeug-Aufruf');
  });
});

describe('the round cap', () => {
  it('defaults to 3 and is env-overridable, 0 meaning "do not recover"', () => {
    const prev = process.env.AGENT_MAX_CONTINUATION_ROUNDS;
    delete process.env.AGENT_MAX_CONTINUATION_ROUNDS;
    expect(agentMaxContinuationRounds()).toBe(3);
    process.env.AGENT_MAX_CONTINUATION_ROUNDS = '0';
    expect(agentMaxContinuationRounds()).toBe(0);
    if (prev === undefined) delete process.env.AGENT_MAX_CONTINUATION_ROUNDS;
    else process.env.AGENT_MAX_CONTINUATION_ROUNDS = prev;
  });
});

// ─── through the real loop ─────────────────────────────────────────────────────

const TOOLS: ToolSpec[] = [
  { name: 'write_file', description: '', parameters: {} },
  { name: 'finish', description: '', parameters: {} },
];

const written: Array<{ path: string; content: string }> = [];
const executor: ToolExecutor = async (call): Promise<ToolResult> => {
  if (call.name === 'write_file') {
    written.push({ path: String(call.args.path), content: String(call.args.content) });
    return {
      ok: true,
      summary: `${call.args.path} · NEU`,
      file: { path: String(call.args.path), classification: 'NEU' },
    };
  }
  return { ok: false, summary: 'unbekannt', error: { code: 'unknown_tool', message: 'x' } };
};

function collector(): { emit: EmitEvent; events: AgentEvent[] } {
  const events: AgentEvent[] = [];
  return { emit: (e) => { events.push(e); }, events };
}

const base = {
  runId: 'run-1', userId: 'u1', projectId: 'p1', sessionId: 's1',
  modelSlug: 'goblin/efficient' as const,
  systemPrompt: 'SYS', tools: TOOLS, executor,
  bill: async () => {},
};

describe('the agent loop under truncation', () => {
  it('writes the file ONCE and whole — no rewrite from the top', async () => {
    written.length = 0;
    const { emit } = collector();
    const WHOLE = '<!doctype html><html><body><h1>Hi</h1></body></html>';
    let call = 0;
    const model: AgentModel = {
      supportsNativeTools: true,
      async turn() {
        call += 1;
        if (call === 1) {
          // The provider cut the tool call apart mid-`content`.
          return {
            content: '', usage,
            toolCalls: [{ id: 'c1', name: 'write_file', args: {} }],
            truncated: true,
            partialToolCall: {
              id: 'c1', name: 'write_file',
              rawArguments: `{"path":"index.html","content":"${WHOLE.slice(0, 20)}`,
            },
          };
        }
        if (call === 2) return { content: WHOLE.slice(20), toolCalls: [], usage, truncated: false };
        return { content: '', usage, toolCalls: [{ id: 'c2', name: 'finish', args: { report: 'Fertig.' } }] };
      },
    };

    const res = await runAgent({ ...base, userMessage: 'Baue eine Seite', model, emit });

    expect(res.outcome).toBe('finished');
    expect(written).toHaveLength(1);          // written once…
    expect(written[0]!.content).toBe(WHOLE);  // …and whole
  });

  it('a cut-off narration is NOT reported as a finished run', async () => {
    const { emit } = collector();
    const model: AgentModel = {
      supportsNativeTools: true,
      // Every turn truncates — recovery can never converge.
      async turn() { return { content: 'Ich denke nach…', toolCalls: [], usage, truncated: true }; },
    };

    const res = await runAgent({
      ...base, userMessage: 'Baue etwas Riesiges', model, emit,
      maxIterations: 2,
    });

    expect(res.outcome).toBe('error');
    expect(res.status).toBe('failed');
    // The honest reason reaches the user through the report — it names the real cause
    // and the real next step, and never calls the cut-off run finished.
    const text = JSON.stringify(res.report);
    expect(text).toContain('nicht zu Ende gebracht');
    expect(text).toContain('kleineren Teilen');
  });

  it('bills every continuation round it spends', async () => {
    const bill = vi.fn();
    const { emit } = collector();
    let call = 0;
    const model: AgentModel = {
      supportsNativeTools: true,
      async turn() {
        call += 1;
        if (call === 1) return { content: 'halb', toolCalls: [], usage, truncated: true };
        return { content: ' fertig', toolCalls: [], usage, truncated: false };
      },
    };

    const res = await runAgent({ ...base, userMessage: 'x', model, emit, bill });

    // The truncated turn AND its continuation are both real model turns, both billed —
    // a continuation is never free and never hidden from the run's unit budget.
    expect(call).toBe(2);
    expect(bill).toHaveBeenCalledTimes(2);
    // …and the stitched narration is what the run finished on, not the fragment.
    expect(JSON.stringify(res.report)).toContain('halb fertig');
  });
});
