// FEEL-3a — shared types for the agent orchestrator loop.
//
// The loop is transport-agnostic: it takes a model (native tools or JSON fallback),
// a tool executor (A3 adapters over the hardened services), and an event sink, and
// returns a result the route turns into SSE + persistence. Nothing here touches the
// network or the DB directly — that keeps the loop unit-testable with mocks.

import type { RunOutcome } from './run-store';

export type { RunOutcome };

/** A tool the model may call. `parameters` is a JSON Schema (native function-calling shape). */
export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** A normalized tool invocation (from native tool_calls OR the JSON fallback protocol). */
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * Structured tool result. `summary` is the short, human line the step stream renders
 * ("index.html", "script.js · GEÄNDERT +14 −2", "zu gross") — it is what makes the
 * report attestable, because it is derived from the real service result, not the
 * model's narration. `file` is set by write_file so the orchestrator can assemble
 * the report's file list from ground truth.
 */
export interface ToolResult {
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: { code: string; message: string };
  file?: ReportFile;
  /** finish() sets this so the loop knows to terminate with the model's report text. */
  terminate?: boolean;
  report?: string;
}

/** Executes one tool call against the real (or a mocked) service. Injected by A3. */
export type ToolExecutor = (call: ToolCall, ctx: ToolContext) => Promise<ToolResult>;

/** Everything a tool needs to act as the run's user, scoped to one project/session. */
export interface ToolContext {
  userId: string;
  projectId: string;
  sessionId: string;
}

/** One entry in the file list of the final report — from real classify results. */
export interface ReportFile {
  path: string;
  classification: 'NEU' | 'GEÄNDERT' | 'IDENTISCH';
  added?: number;
  removed?: number;
}

/** A model turn: narration text + any tool calls + token usage. */
export interface ModelTurn {
  content: string;
  toolCalls: ToolCall[];
  usage: { inputTokens: number; outputTokens: number };
  /** Opaque assistant message to append to history for the next turn (native tools carry ids). */
  assistantMessage?: unknown;
}

/** A conversational message in the running loop. */
export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** For tool-result messages under native function calling. */
  toolCallId?: string;
  name?: string;
  /** Raw assistant payload (native tool_calls) round-tripped verbatim. */
  raw?: unknown;
}

/** The model abstraction the loop drives. Two impls: native goblin + JSON fallback wrapper. */
export interface AgentModel {
  readonly supportsNativeTools: boolean;
  turn(input: { messages: AgentMessage[]; tools: ToolSpec[]; signal?: AbortSignal }): Promise<ModelTurn>;
}

/** Events the loop emits as it runs — the route wraps these into SSE frames. */
export type AgentEvent =
  | { type: 'agent_narration'; text: string }
  | { type: 'agent_step'; tool: string; summary: string; ok: boolean; ms: number }
  | { type: 'agent_report'; report: ReportCard };

export type EmitEvent = (evt: AgentEvent) => void | Promise<void>;

/**
 * The final report — assembled by the ORCHESTRATOR from tool results (§5.1). The
 * model's own words live in `modelText`, quoted separately; every attestable fact
 * (files, deltas, saved state, units) comes from the execution log, never the model.
 */
export interface ReportCard {
  outcome: RunOutcome;
  /** draft-saved | draft-unsaved | failed | stopped — the truthful landing state. */
  state: 'draft-saved' | 'draft-unsaved' | 'failed' | 'stopped';
  files: ReportFile[];
  unitsConsumed: number;
  /** The model's finish() report text (or last narration), quoted — never treated as truth. */
  modelText: string;
  /** One-tap follow-ups the card offers (publish arrives in 3b — 'go-live' points at "Live stellen"). */
  followUps: Array<'view-changes' | 'go-live' | 'open'>;
  failureReason?: string;
}

/** What a completed run returns to the route (for persistence + the final SSE frame). */
export interface RunResult {
  outcome: RunOutcome;
  status: 'success' | 'failed';
  report: ReportCard;
  steps: Array<{ tool: string; args: string; outcome: string; ms: number }>;
  toolsUsed: string[];
  iterations: number;
  tokensIn: number;
  tokensOut: number;
  unitsConsumed: number;
}
