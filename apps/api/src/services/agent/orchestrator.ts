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
import { parseFallbackToolCall, REPAIR_INSTRUCTION } from './protocol';
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
  failureReason?: string,
): ReportCard {
  let state: ReportCard['state'];
  if (outcome === 'stopped') state = 'stopped';
  else if (outcome === 'error') state = 'failed';
  else state = savedDraft ? 'draft-saved' : 'draft-unsaved';

  const followUps: ReportCard['followUps'] = [];
  if (files.length > 0) followUps.push('view-changes');
  if (savedDraft) {
    followUps.push('go-live'); // 3b wires publish; here it points at the manual "Live stellen"
    followUps.push('open');
  }

  return { outcome, state, files, unitsConsumed: units, modelText, followUps, failureReason };
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
  let tokensIn = 0;
  let tokensOut = 0;
  let units = 0;
  let iterations = 0;
  let repairsUsed = 0;
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
    let calls: ToolCall[] = turn.toolCalls;
    if (calls.length === 0) {
      const parsed = parseFallbackToolCall(turn.content);
      if (parsed.kind === 'call') {
        calls = [parsed.call];
      } else if (parsed.kind === 'malformed') {
        if (repairsUsed < 1) {
          repairsUsed += 1;
          messages.push({ role: 'system', content: REPAIR_INSTRUCTION });
          continue; // exactly one repair reprompt, then honest abort
        }
        outcome = 'error';
        failureReason = 'Ungültiges Tool-Protokoll nach Reparaturversuch';
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

      const t0 = Date.now();
      let result: ToolResult;
      try {
        result = await input.executor(call, {
          userId: input.userId,
          projectId: input.projectId,
          sessionId: input.sessionId,
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

      messages.push(toolResultMessage(call, result, model.supportsNativeTools));

      if (stop?.aborted) { outcome = 'stopped'; terminated = true; break; }
    }

    if (terminated) break;
  }

  // Exhausted the iteration budget without a finish → truthful budget landing.
  if (outcome === null) outcome = 'budget';

  const fileList = [...files.values()];
  const report = assembleReport(outcome, fileList, savedDraft, units, modelText, failureReason);
  const status: RunResult['status'] = outcome === 'error' ? 'failed' : 'success';

  await input.emit({ type: 'agent_report', report });

  return {
    outcome,
    status,
    report,
    steps,
    toolsUsed: [...toolsUsed],
    iterations,
    tokensIn,
    tokensOut,
    unitsConsumed: units,
  };
}
