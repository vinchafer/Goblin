// FEEL-3c C1 — real-model harness for the JSON-protocol fallback + native path.
//
// Drives the REAL orchestrator loop against:
//   • Goblin Forge (moonshotai/Kimi-K2.6) — native function calling, real DeepInfra.
//   • Groq (llama-3.3-70b) — supportsNativeTools:false → forces the strict JSON
//     fallback protocol (protocol.ts) on real, non-native model output. HARNESS test
//     of the parser only; Groq is NOT added to the eligible list here (founder call).
//
// A stub executor keeps files in memory (no Supabase / no Vercel) so the loop exercises
// the parser + report assembly on genuine model output without side effects. Every model
// turn's raw content is logged — that IS the parser evidence.


import OpenAI from 'openai';
import { runAgent } from './src/services/agent/orchestrator';
import { AGENT_TOOLS } from './src/services/agent/tools';
import { nativeGoblinModel } from './src/services/agent/model-turn';
import { buildAgentSystemPrompt } from './src/prompts/goblin-chat-system';
import type { AgentModel, ToolCall, ToolContext, ToolResult, AgentEvent } from './src/services/agent/types';

const SCENARIO =
  'Baue eine einfache Mini-Umfrage-Seite (index.html) mit einer Frage „Kaffee oder Tee?" ' +
  'und zwei Buttons, die die Stimme in localStorage zählen. Und sag mir, wenn es live ist.';

// ── In-memory stub executor: real loop, no external services ──────────────────
function makeStubExecutor() {
  const files = new Map<string, string>();
  const turns: string[] = [];
  const exec = async (call: ToolCall, _ctx: ToolContext): Promise<ToolResult> => {
    switch (call.name) {
      case 'list_files':
        return { ok: true, summary: `${files.size} Dateien`, data: [...files.keys()] };
      case 'read_file': {
        const p = String(call.args?.path ?? '');
        const c = files.get(p);
        if (c == null) return { ok: false, summary: `${p} · nicht gefunden`, error: { code: 'not_found', message: `${p} existiert nicht` } };
        return { ok: true, summary: p, data: c };
      }
      case 'write_file': {
        const p = String(call.args?.path ?? '');
        const content = String(call.args?.content ?? '');
        const existed = files.has(p);
        files.set(p, content);
        const added = content.split('\n').length;
        return {
          ok: true,
          summary: existed ? `${p} · GEÄNDERT +${added} −0` : `${p} · NEU`,
          file: { path: p, classification: existed ? 'GEÄNDERT' : 'NEU', added, removed: 0 },
          data: { classification: existed ? 'GEÄNDERT' : 'NEU', added, removed: 0, integrity: 'ok' },
        };
      }
      case 'save_draft':
        return { ok: true, summary: `${files.size} Dateien gesichert ✓`, data: { saved: files.size } };
      case 'publish':
        return { ok: true, summary: 'Live ✓ (geprüft)', data: { url: 'https://feel3c-harness-stub.vercel.app' } };
      case 'read_deploy_status':
        return { ok: true, summary: 'nicht veröffentlicht', data: { status: 'not_published' } };
      default:
        return { ok: false, summary: `unbekannt: ${call.name}`, error: { code: 'unknown_tool', message: call.name } };
    }
  };
  return { exec, files, turns };
}

// ── Groq model driving the JSON fallback (no native tools) ────────────────────
function groqFallbackModel(): AgentModel {
  const key = process.env.GROQ_FREE_API_KEY_2 || process.env.GROQ_FREE_API_KEY;
  const client = new OpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1' });
  return {
    supportsNativeTools: false,
    async turn({ messages }) {
      const resp = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: messages.map((m) => ({
          role: (m.role === 'tool' ? 'user' : m.role) as 'system' | 'user' | 'assistant',
          content: m.role === 'tool' ? `TOOL_RESULT ${m.name}: ${m.content}` : m.content,
        })),
        max_tokens: 1400,
        temperature: 0,
      });
      const content = resp.choices[0]?.message?.content ?? '';
      return {
        content,
        toolCalls: [],
        usage: { inputTokens: resp.usage?.prompt_tokens ?? 0, outputTokens: resp.usage?.completion_tokens ?? 0 },
      };
    },
  };
}

// Wrap a model so every raw turn is logged — the parser evidence.
function logging(model: AgentModel, sink: string[]): AgentModel {
  return {
    supportsNativeTools: model.supportsNativeTools,
    async turn(input) {
      const out = await model.turn(input);
      const native = out.toolCalls.length ? ` [native:${out.toolCalls.map((c) => c.name).join(',')}]` : '';
      sink.push(`--- turn${native} ---\n${(out.content || '(leer)').slice(0, 600)}`);
      return out;
    },
  };
}

async function runOne(label: string, model: AgentModel) {
  const { exec, files } = makeStubExecutor();
  const events: AgentEvent[] = [];
  const rawTurns: string[] = [];
  const res = await runAgent({
    runId: null,
    userId: 'harness',
    projectId: 'harness',
    sessionId: 'harness',
    modelSlug: 'goblin/premium',
    systemPrompt: buildAgentSystemPrompt({}),
    userMessage: SCENARIO,
    tools: AGENT_TOOLS,
    executor: exec,
    emit: (e) => { events.push(e); },
    publishGranted: true,
    model: logging(model, rawTurns),
    maxIterations: 6,
    bill: () => {},
  });
  return {
    label,
    outcome: res.outcome,
    state: res.report.state,
    iterations: res.iterations,
    healCycles: res.healCycles,
    toolsUsed: res.toolsUsed,
    publishedUrl: res.report.publishedUrl ?? null,
    failureReason: res.report.failureReason ?? null,
    files: [...files.keys()],
    steps: res.steps.map((s) => `${s.tool}:${s.outcome} (${s.ms}ms)`),
    rawTurns,
  };
}

const which = process.argv[2] ?? 'both';
const out: Record<string, unknown> = {};
try {
  if (which === 'forge' || which === 'both') {
    out.forge = await runOne('Goblin Forge (native, DeepInfra)', nativeGoblinModel('goblin/premium'));
  }
} catch (e) {
  out.forge = { error: (e as Error).message };
}
try {
  if (which === 'groq' || which === 'both') {
    out.groq = await runOne('Groq llama-3.3-70b (JSON fallback)', groqFallbackModel());
  }
} catch (e) {
  out.groq = { error: (e as Error).message };
}
console.log(JSON.stringify(out, null, 2));
