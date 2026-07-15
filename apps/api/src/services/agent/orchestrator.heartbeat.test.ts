// FW5-U6 — Forge heartbeat. The agent turn is non-streaming, so a slow Forge first
// turn would sit visually silent. These tests assert the honest presence line is
// emitted through the narration stream ONLY for a slow Forge first turn, that it is
// replaced by real content, that a fast turn never shows it, and that a pure-tool-call
// first turn tidies the slot back to the generic state. No fake progress.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runAgent } from './orchestrator';
import type { AgentModel, ModelTurn, ToolExecutor, ToolResult, EmitEvent, AgentEvent, ToolSpec } from './types';

const FORGE_HEARTBEAT_TEXT = 'Goblin Forge arbeitet an einem größeren Wurf — das kann einen Moment dauern.';

const TOOLS: ToolSpec[] = [
  { name: 'write_file', description: '', parameters: {} },
  { name: 'save_draft', description: '', parameters: {} },
  { name: 'finish', description: '', parameters: {} },
];

const executor: ToolExecutor = async (call): Promise<ToolResult> => {
  switch (call.name) {
    case 'write_file':
      return { ok: true, summary: `${call.args.path} · NEU`, file: { path: String(call.args.path), classification: 'NEU' } };
    case 'save_draft':
      return { ok: true, summary: 'Entwurf gesichert ✓' };
    default:
      return { ok: false, summary: 'x', error: { code: 'unknown_tool', message: 'x' } };
  }
};

function nativeTurn(name: string, args: Record<string, unknown> = {}, content = ''): ModelTurn {
  return { content, toolCalls: [{ id: `c${name}`, name, args }], usage: { inputTokens: 50, outputTokens: 10 } };
}

/** A model whose FIRST turn resolves only after `delayMs`; later turns are immediate. */
function slowFirstModel(delayMs: number, turns: ModelTurn[]): AgentModel {
  let i = 0;
  return {
    supportsNativeTools: true,
    async turn() {
      const idx = Math.min(i, turns.length - 1);
      i += 1;
      if (idx === 0 && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      return turns[idx]!;
    },
  };
}

function collector(): { emit: EmitEvent; events: AgentEvent[] } {
  const events: AgentEvent[] = [];
  return { emit: (e) => { events.push(e); }, events };
}

const base = {
  runId: 'run-hb', userId: 'u1', projectId: 'p1', sessionId: 's1',
  systemPrompt: 'SYS', tools: TOOLS, executor,
  bill: async () => {},
};

const narrations = (events: AgentEvent[]) =>
  events.filter((e): e is Extract<AgentEvent, { type: 'agent_narration' }> => e.type === 'agent_narration').map((e) => e.text);

describe('orchestrator — Forge heartbeat (FW5-U6)', () => {
  beforeEach(() => { process.env.AGENT_FORGE_HEARTBEAT_MS = '10'; });
  afterEach(() => { delete process.env.AGENT_FORGE_HEARTBEAT_MS; });

  it('slow Forge first turn: emits the honest line, then real content replaces it', async () => {
    const { emit, events } = collector();
    await runAgent({
      ...base,
      modelSlug: 'goblin/premium',
      userMessage: 'Bau etwas Großes',
      model: slowFirstModel(60, [
        nativeTurn('write_file', { path: 'index.html', content: '<html>' }, 'Ich schreibe index.html'),
        nativeTurn('finish', { report: 'Fertig.' }),
      ]),
      emit,
    });
    const texts = narrations(events);
    // The heartbeat appears, and the real content narration comes strictly after it.
    expect(texts).toContain(FORGE_HEARTBEAT_TEXT);
    expect(texts).toContain('Ich schreibe index.html');
    expect(texts.indexOf(FORGE_HEARTBEAT_TEXT)).toBeLessThan(texts.indexOf('Ich schreibe index.html'));
  });

  it('Swift never shows the Forge heartbeat, even on a slow first turn', async () => {
    const { emit, events } = collector();
    await runAgent({
      ...base,
      modelSlug: 'goblin/efficient',
      userMessage: 'Bau etwas',
      model: slowFirstModel(60, [
        nativeTurn('write_file', { path: 'a.html', content: '<html>' }, 'Ich arbeite'),
        nativeTurn('finish', { report: 'Fertig.' }),
      ]),
      emit,
    });
    expect(narrations(events)).not.toContain(FORGE_HEARTBEAT_TEXT);
  });

  it('fast Forge first turn (under the delay) never shows the line', async () => {
    process.env.AGENT_FORGE_HEARTBEAT_MS = '5000';
    const { emit, events } = collector();
    await runAgent({
      ...base,
      modelSlug: 'goblin/premium',
      userMessage: 'Kleine Änderung',
      model: slowFirstModel(0, [
        nativeTurn('write_file', { path: 'a.html', content: '<html>' }, 'Sofort da'),
        nativeTurn('finish', { report: 'Fertig.' }),
      ]),
      emit,
    });
    expect(narrations(events)).not.toContain(FORGE_HEARTBEAT_TEXT);
  });

  it('pure-tool-call first turn: heartbeat fires, then the slot is cleared', async () => {
    const { emit, events } = collector();
    await runAgent({
      ...base,
      modelSlug: 'goblin/premium',
      userMessage: 'Bau etwas Großes',
      // First turn: a tool call with NO content — nothing to overwrite the heartbeat.
      model: slowFirstModel(60, [
        nativeTurn('write_file', { path: 'index.html', content: '<html>' }, ''),
        nativeTurn('finish', { report: 'Fertig.' }),
      ]),
      emit,
    });
    const texts = narrations(events);
    expect(texts).toContain(FORGE_HEARTBEAT_TEXT);
    // The empty-string reset is emitted after the heartbeat to fall back to generic.
    const hbIdx = texts.indexOf(FORGE_HEARTBEAT_TEXT);
    expect(texts.slice(hbIdx + 1)).toContain('');
  });
});
