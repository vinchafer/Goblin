// A-4 (plan mode) gate — the orchestrator emits a DISTINCT agent_plan step for a
// mehrschrittige run and NOT for a trivial one, announce-then-act (no approval wait),
// and the plan never terminates the run or burns a heal cycle.

import { describe, it, expect } from 'vitest';
import { runAgent } from './orchestrator';
import type { AgentModel, ModelTurn, ToolExecutor, ToolResult, ToolSpec, EmitEvent, AgentEvent } from './types';

const TOOLS: ToolSpec[] = [
  { name: 'plan', description: '', parameters: {} },
  { name: 'read_file', description: '', parameters: {} },
  { name: 'write_file', description: '', parameters: {} },
  { name: 'save_draft', description: '', parameters: {} },
  { name: 'finish', description: '', parameters: {} },
];

function scriptedModel(turns: ModelTurn[]): AgentModel {
  let i = 0;
  return { supportsNativeTools: true, async turn() { const t = turns[Math.min(i, turns.length - 1)]; i += 1; return t!; } };
}
function nativeTurn(name: string, args: Record<string, unknown> = {}, content = ''): ModelTurn {
  return { content, toolCalls: [{ id: `c${name}`, name, args }], usage: { inputTokens: 100, outputTokens: 20 } };
}

const executor: ToolExecutor = async (call): Promise<ToolResult> => {
  switch (call.name) {
    case 'write_file':
      return { ok: true, summary: `${call.args.path} · NEU`, file: { path: String(call.args.path), classification: 'NEU' } };
    case 'save_draft':
      return { ok: true, summary: 'Entwurf gesichert ✓' };
    default:
      return { ok: true, summary: 'ok' };
  }
};

function collector(): { emit: EmitEvent; events: AgentEvent[] } {
  const events: AgentEvent[] = [];
  return { emit: (e) => { events.push(e); }, events };
}

const base = {
  runId: 'run-1', userId: 'u1', projectId: 'p1', sessionId: 's1',
  modelSlug: 'goblin/efficient' as const, systemPrompt: 'SYS',
  tools: TOOLS, executor, bill: async () => {},
};

describe('A-4 plan mode', () => {
  it('complex run: plan → build → finish; plan emitted as a distinct step, not a terminator', async () => {
    const { emit, events } = collector();
    const res = await runAgent({
      ...base,
      userMessage: 'Bau eine Settings-Seite mit Dark-Mode und stell sie live',
      model: scriptedModel([
        nativeTurn('plan', { steps: ['settings.html anlegen', 'Toggle-Logik', 'live stellen'] }, 'Plan steht'),
        nativeTurn('write_file', { path: 'settings.html', content: '<html>' }, 'Ich lege settings.html an'),
        nativeTurn('save_draft', {}, 'Ich sichere'),
        nativeTurn('finish', { report: 'Fertig.' }),
      ]),
      emit,
    });

    const planEvents = events.filter((e) => e.type === 'agent_plan');
    expect(planEvents).toHaveLength(1);
    expect((planEvents[0] as { steps: string[] }).steps).toEqual(['settings.html anlegen', 'Toggle-Logik', 'live stellen']);
    // The run continued past the plan and finished normally — announce-then-act.
    expect(res.outcome).toBe('finished');
    expect(res.healCycles).toBe(0);
    expect(res.toolsUsed).toContain('plan');
    // The plan is logged as its own step in the execution log.
    expect(res.steps.some((s) => s.tool === 'plan')).toBe(true);
    // Building actually happened after the plan.
    expect(res.report.files.map((f) => f.path)).toContain('settings.html');
  });

  it('trivial run: no plan tool call → no agent_plan event', async () => {
    const { emit, events } = collector();
    const res = await runAgent({
      ...base,
      userMessage: 'Mach die Überschrift größer',
      model: scriptedModel([
        nativeTurn('write_file', { path: 'index.html', content: '<h1>' }, 'Ich vergrößere die Überschrift'),
        nativeTurn('finish', { report: 'Erledigt.' }),
      ]),
      emit,
    });
    expect(events.some((e) => e.type === 'agent_plan')).toBe(false);
    expect(res.outcome).toBe('finished');
  });

  it('a repeated plan call is acknowledged but the plan frame is emitted only once', async () => {
    const { emit, events } = collector();
    await runAgent({
      ...base,
      userMessage: 'komplex',
      model: scriptedModel([
        nativeTurn('plan', { steps: ['a', 'b'] }),
        nativeTurn('plan', { steps: ['c', 'd'] }),
        nativeTurn('finish', { report: 'ok' }),
      ]),
      emit,
    });
    expect(events.filter((e) => e.type === 'agent_plan')).toHaveLength(1);
  });
});
