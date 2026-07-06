// FEEL-3a A2 gate: the orchestrator loop under a deterministic mocked model + executor.
// Covers the four required paths — happy loop, parse-repair, budget-forced finish,
// stop mid-run — plus billing-per-turn and report assembly from tool results.

import { describe, it, expect, vi } from 'vitest';
import { runAgent } from './orchestrator';
import type { AgentModel, ModelTurn, ToolExecutor, ToolResult, ToolSpec, EmitEvent, AgentEvent } from './types';

const TOOLS: ToolSpec[] = [
  { name: 'list_files', description: '', parameters: {} },
  { name: 'read_file', description: '', parameters: {} },
  { name: 'write_file', description: '', parameters: {} },
  { name: 'save_draft', description: '', parameters: {} },
  { name: 'publish', description: '', parameters: {} },
  { name: 'read_deploy_status', description: '', parameters: {} },
  { name: 'finish', description: '', parameters: {} },
];

/** A model that replays a scripted list of turns; extra turns repeat the last one. */
function scriptedModel(turns: ModelTurn[], native = true): AgentModel {
  let i = 0;
  return {
    supportsNativeTools: native,
    async turn() {
      const t = turns[Math.min(i, turns.length - 1)];
      i += 1;
      return t!;
    },
  };
}

function nativeTurn(name: string, args: Record<string, unknown> = {}, content = '', usage = { inputTokens: 100, outputTokens: 20 }): ModelTurn {
  return { content, toolCalls: [{ id: `c${name}`, name, args }], usage };
}
function textTurn(content: string, usage = { inputTokens: 100, outputTokens: 20 }): ModelTurn {
  return { content, toolCalls: [], usage };
}

/** Executor with realistic structured results for the five tools. */
const executor: ToolExecutor = async (call): Promise<ToolResult> => {
  switch (call.name) {
    case 'list_files':
      return { ok: true, summary: '2 Dateien', data: ['index.html', 'style.css'] };
    case 'read_file':
      return { ok: true, summary: String(call.args.path ?? ''), data: '<html></html>' };
    case 'write_file':
      return {
        ok: true,
        summary: `${call.args.path} · NEU`,
        file: { path: String(call.args.path), classification: 'NEU' },
      };
    case 'save_draft':
      return { ok: true, summary: 'Entwurf gesichert ✓' };
    default:
      return { ok: false, summary: 'unbekannt', error: { code: 'unknown_tool', message: 'x' } };
  }
};

function collector(): { emit: EmitEvent; events: AgentEvent[] } {
  const events: AgentEvent[] = [];
  return { emit: (e) => { events.push(e); }, events };
}

const base = {
  runId: 'run-1',
  userId: 'u1',
  projectId: 'p1',
  sessionId: 's1',
  modelSlug: 'goblin/efficient' as const,
  systemPrompt: 'SYS',
  tools: TOOLS,
  executor,
  bill: async () => {}, // default no-op biller; the billing test overrides with a spy
};

describe('orchestrator — A2 loop', () => {
  it('happy loop: write_file → save_draft → finish → attested draft-saved report', async () => {
    const { emit, events } = collector();
    const bill = vi.fn();
    const res = await runAgent({
      ...base,
      userMessage: 'Baue eine Notiz-App',
      model: scriptedModel([
        nativeTurn('write_file', { path: 'index.html', content: '<html>' }, 'Ich schreibe index.html'),
        nativeTurn('save_draft', {}, 'Ich sichere den Entwurf'),
        nativeTurn('finish', { report: 'Fertig — Notiz-App als Entwurf gesichert.' }),
      ]),
      emit,
      bill,
    });

    expect(res.outcome).toBe('finished');
    expect(res.status).toBe('success');
    expect(res.iterations).toBe(3);
    expect(res.toolsUsed).toEqual(['write_file', 'save_draft']); // finish is control-flow, not a service call
    expect(res.report.state).toBe('draft-saved');
    expect(res.report.files).toEqual([{ path: 'index.html', classification: 'NEU' }]);
    expect(res.report.modelText).toBe('Fertig — Notiz-App als Entwurf gesichert.');
    expect(res.report.followUps).toContain('view-changes');
    // FEEL-3b: a saved-but-unpublished draft now carries the D1 confirmation chip.
    expect(res.report.followUps).toContain('confirm-publish');
    // billed once per model turn (3 turns).
    expect(bill).toHaveBeenCalledTimes(3);
    // step events emitted for the two service tools, and a final report frame.
    expect(events.filter((e) => e.type === 'agent_step')).toHaveLength(2);
    expect(events.filter((e) => e.type === 'agent_report')).toHaveLength(1);
    // execution log persisted with the real classification summary.
    expect(res.steps.map((s) => s.tool)).toEqual(['write_file', 'save_draft']);
  });

  it('parse-repair path: malformed fallback tool_call → one repair → then valid finish', async () => {
    const { emit } = collector();
    const res = await runAgent({
      ...base,
      userMessage: 'x',
      model: scriptedModel(
        [
          textTurn('```tool_call\n{ not json ```'), // malformed → triggers repair
          textTurn('```tool_call\n{"tool":"finish","args":{"report":"ok"}}\n```'),
        ],
        false, // fallback (no native tools)
      ),
      emit,
    });
    expect(res.outcome).toBe('finished');
    expect(res.report.modelText).toBe('ok');
    // two model turns: the malformed one + the repaired finish.
    expect(res.iterations).toBe(2);
  });

  it('malformed twice → honest error abort after the single repair', async () => {
    const { emit } = collector();
    const res = await runAgent({
      ...base,
      userMessage: 'x',
      model: scriptedModel([textTurn('```tool_call\n{bad```')], false),
      maxIterations: 5,
      emit,
    });
    expect(res.outcome).toBe('error');
    expect(res.status).toBe('failed');
    expect(res.report.state).toBe('failed');
    expect(res.report.failureReason).toMatch(/Tool-Protokoll/);
  });

  it('plain prose with no tool call is an honest implicit finish (refusal path)', async () => {
    const { emit } = collector();
    const res = await runAgent({
      ...base,
      userMessage: 'Suche im Web',
      model: scriptedModel([textTurn('Das kann ich nicht — ich habe keinen Web-Zugriff.')], false),
      emit,
    });
    expect(res.outcome).toBe('finished');
    expect(res.report.files).toHaveLength(0);
    expect(res.report.modelText).toMatch(/keinen Web-Zugriff/);
  });

  it('budget-forced finish: iteration cap reached without finish → outcome budget', async () => {
    const { emit } = collector();
    const res = await runAgent({
      ...base,
      userMessage: 'x',
      model: scriptedModel([nativeTurn('list_files', {}, 'schaue mich um')]), // never finishes
      maxIterations: 2,
      emit,
    });
    expect(res.outcome).toBe('budget');
    expect(res.iterations).toBe(2);
    expect(res.status).toBe('success'); // clean bounded stop, not a crash
  });

  it('budget-forced finish: unit budget reached → outcome budget before next turn', async () => {
    const { emit } = collector();
    const res = await runAgent({
      ...base,
      userMessage: 'x',
      model: scriptedModel([nativeTurn('list_files', {}, '', { inputTokens: 500, outputTokens: 0 })]),
      maxUnits: 100,
      maxIterations: 8,
      emit,
    });
    expect(res.outcome).toBe('budget');
    expect(res.iterations).toBe(1); // one turn ran (500 units), budget tripped before turn 2
    expect(res.unitsConsumed).toBeGreaterThanOrEqual(100);
  });

  it('stop mid-run: Stopp after the in-flight tool → outcome stopped, partial state persists', async () => {
    const { emit } = collector();
    const controller = new AbortController();
    // Abort as soon as the first tool executes, so the loop stops after it completes.
    const stopExecutor: ToolExecutor = async (call, ctx) => {
      const r = await executor(call, ctx);
      controller.abort();
      return r;
    };
    const res = await runAgent({
      ...base,
      executor: stopExecutor,
      userMessage: 'Baue viel',
      model: scriptedModel([
        nativeTurn('write_file', { path: 'index.html', content: '<html>' }),
        nativeTurn('write_file', { path: 'app.js', content: 'x' }),
        nativeTurn('finish', { report: 'sollte nie erreicht werden' }),
      ]),
      stopSignal: controller.signal,
      emit,
    });
    expect(res.outcome).toBe('stopped');
    expect(res.report.state).toBe('stopped');
    // the in-flight write completed and is attested; the run did not reach finish.
    expect(res.report.files).toEqual([{ path: 'index.html', classification: 'NEU' }]);
    expect(res.steps).toHaveLength(1);
  });
});

// ─── FEEL-3b B2: the explicit-intent publish gate (D1) ───────────────────────────

/** Executor that also serves a green `publish` and records which tools actually ran. */
function publishExecutor(ran: string[]): ToolExecutor {
  return async (call): Promise<ToolResult> => {
    ran.push(call.name);
    switch (call.name) {
      case 'write_file':
        return { ok: true, summary: `${call.args.path} · NEU`, file: { path: String(call.args.path), classification: 'NEU' } };
      case 'save_draft':
        return { ok: true, summary: 'Entwurf gesichert ✓' };
      case 'publish':
        return { ok: true, summary: 'Live ✓ https://p1.vercel.app', data: { verified: true, url: 'https://p1.vercel.app' } };
      default:
        return { ok: false, summary: 'unbekannt', error: { code: 'unknown_tool', message: 'x' } };
    }
  };
}

describe('orchestrator — B2 publish gate (D1)', () => {
  it('granted: explicit intent → publish executes → verified-live report with the URL', async () => {
    const { emit } = collector();
    const ran: string[] = [];
    const res = await runAgent({
      ...base,
      executor: publishExecutor(ran),
      publishGranted: true,
      userMessage: 'Baue eine Umfrage und stell sie live.',
      model: scriptedModel([
        nativeTurn('write_file', { path: 'index.html', content: '<html>' }, 'Ich baue die Seite'),
        nativeTurn('save_draft', {}, 'Ich sichere'),
        nativeTurn('publish', {}, 'Ich stelle live'),
        nativeTurn('finish', { report: 'Live gestellt.' }),
      ]),
      emit,
    });
    expect(ran).toContain('publish');
    expect(res.report.state).toBe('published');
    expect(res.report.publishedUrl).toBe('https://p1.vercel.app');
    expect(res.report.followUps).toContain('open');
    expect(res.toolsUsed).toContain('publish');
  });

  it('not granted: a publish call is DENIED before the deploy → draft-saved + chip', async () => {
    const { emit, events } = collector();
    const ran: string[] = [];
    const res = await runAgent({
      ...base,
      executor: publishExecutor(ran),
      publishGranted: false,
      userMessage: 'Baue eine Umfrage.', // no publish signal
      model: scriptedModel([
        nativeTurn('write_file', { path: 'index.html', content: '<html>' }, 'Ich baue die Seite'),
        nativeTurn('publish', {}, 'Ich stelle live'), // model tries anyway → denied
        nativeTurn('save_draft', {}, 'Ich sichere den Entwurf'),
        nativeTurn('finish', { report: 'Als Entwurf gesichert.' }),
      ]),
      emit,
    });
    expect(ran).not.toContain('publish'); // never reached the deploy
    expect(res.report.state).toBe('draft-saved');
    expect(res.report.publishedUrl).toBeUndefined();
    expect(res.report.followUps).toContain('confirm-publish'); // the D1 chip
    // the denial surfaced as a failed step in the log/stream (honest narration).
    expect(res.steps.some((s) => s.tool === 'publish' && s.outcome === 'intent_required')).toBe(true);
    expect(events.some((e) => e.type === 'agent_step' && e.tool === 'publish' && !e.ok)).toBe(true);
  });

  it('chip tap semantics: a publish-only granted run publishes and lands verified-live', async () => {
    const { emit } = collector();
    const ran: string[] = [];
    const res = await runAgent({
      ...base,
      executor: publishExecutor(ran),
      publishGranted: true, // the route sets this when the chip is tapped
      userMessage: 'Jetzt veröffentlichen',
      model: scriptedModel([
        nativeTurn('publish', {}, 'Ich stelle live'),
        nativeTurn('finish', { report: 'Live.' }),
      ]),
      emit,
    });
    expect(ran).toContain('publish');
    expect(res.report.state).toBe('published');
    expect(res.report.publishedUrl).toBe('https://p1.vercel.app');
  });
});

// ─── FEEL-3b B3: bounded self-heal (spec §5.3) ───────────────────────────────────

/** Executor whose publish is red for the first `redPublishes` calls, then green. */
function healingExecutor(redPublishes: number): ToolExecutor {
  let publishCalls = 0;
  return async (call): Promise<ToolResult> => {
    switch (call.name) {
      case 'write_file':
        return { ok: true, summary: `${call.args.path} · NEU`, file: { path: String(call.args.path), classification: 'NEU' } };
      case 'save_draft':
        return { ok: true, summary: 'Entwurf gesichert ✓' };
      case 'publish': {
        publishCalls += 1;
        if (publishCalls <= redPublishes) {
          return {
            ok: false,
            summary: 'Prüfung fehlgeschlagen: styles.css nicht erreichbar',
            error: { code: 'verify_failed', message: 'styles.css nicht erreichbar' },
            data: { verified: false, failedAssets: ['styles.css'] },
          };
        }
        return { ok: true, summary: 'Live ✓ https://p1.vercel.app', data: { verified: true, url: 'https://p1.vercel.app' } };
      }
      default:
        return { ok: false, summary: 'unbekannt', error: { code: 'unknown_tool', message: 'x' } };
    }
  };
}

describe('orchestrator — B3 self-heal', () => {
  it('one red gate → narrated corrective cycle → green verified-live (heal=1)', async () => {
    const { emit, events } = collector();
    const res = await runAgent({
      ...base,
      executor: healingExecutor(1), // fails once, then green
      publishGranted: true,
      userMessage: 'Baue X und stell es live',
      model: scriptedModel([
        nativeTurn('write_file', { path: 'index.html', content: '<link href=styles.css>' }, 'Ich baue die Seite'),
        nativeTurn('save_draft', {}, 'Ich sichere'),
        nativeTurn('publish', {}, 'Ich stelle live'), // → red, narrated, continue
        nativeTurn('write_file', { path: 'styles.css', content: 'body{}' }, 'Ich ergänze styles.css'),
        nativeTurn('publish', {}, 'Ich stelle erneut live'), // → green
        nativeTurn('finish', { report: 'Live nach einer Korrektur.' }),
      ]),
      emit,
    });
    expect(res.healCycles).toBe(1);
    expect(res.report.state).toBe('published');
    expect(res.report.publishedUrl).toBe('https://p1.vercel.app');
    // the corrective cycle was narrated verbatim ("Prüfung fehlgeschlagen: styles.css …").
    expect(events.some((e) => e.type === 'agent_narration' && /Prüfung fehlgeschlagen/.test(e.text))).toBe(true);
  });

  it('unfixable: 2 red cycles → forced honest failure (never a 3rd attempt)', async () => {
    const { emit } = collector();
    const ran: string[] = [];
    const spy: ToolExecutor = async (call, ctx) => { ran.push(call.name); return healingExecutor(99)(call, ctx); };
    const res = await runAgent({
      ...base,
      executor: spy, // publish always red
      publishGranted: true,
      userMessage: 'Baue X und stell es live',
      model: scriptedModel([
        nativeTurn('write_file', { path: 'index.html', content: '<link href=styles.css>' }),
        nativeTurn('publish', {}), // red → cycle 1
        nativeTurn('write_file', { path: 'index.html', content: '<fixed>' }),
        nativeTurn('publish', {}), // red → cycle 2 → forced finish
        nativeTurn('publish', {}), // MUST NOT run
      ]),
      maxIterations: 8,
      emit,
    });
    expect(res.healCycles).toBe(2);
    expect(res.outcome).toBe('error');
    expect(res.report.state).toBe('failed');
    expect(res.report.failureReason).toMatch(/2 Korrekturversuchen/);
    expect(res.report.failureReason).toContain('styles.css');
    // exactly two publish attempts reached the executor — the 3rd never ran.
    expect(ran.filter((t) => t === 'publish')).toHaveLength(2);
    // the step log carries the exact cycle count (two failed publish steps).
    expect(res.steps.filter((s) => s.tool === 'publish' && s.outcome === 'verify_failed')).toHaveLength(2);
  });
});
