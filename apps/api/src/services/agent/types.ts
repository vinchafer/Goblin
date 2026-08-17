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
  /** FEEL-3b: sub-step progress sink (deploy/verify narration, "wird geprüft 3/6"). */
  emitProgress?: (msg: string) => void | Promise<void>;
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
  /**
   * TRUNC-2: the provider cut this turn off at the output-token ceiling
   * (`finish_reason: length`). The turn is INCOMPLETE — its text stops mid-sentence
   * and any tool call it started is half-written. The orchestrator must never treat
   * such a turn as a finished thought.
   */
  truncated?: boolean;
  /**
   * TRUNC-2: when a truncated turn cut a tool call apart, the raw (unparseable)
   * argument JSON as far as the provider delivered it. `write_file` is the case that
   * matters: the `path` is complete long before the `content` runs out, so the
   * continuation can finish the file instead of rewriting it from the top.
   */
  partialToolCall?: { id: string; name: string; rawArguments: string };
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
  // A-4 (plan mode): on a complex/ambiguous run the model narrates its plan FIRST,
  // as a distinct step type, before any file tool. Trivial runs never emit this.
  | { type: 'agent_plan'; steps: string[] }
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
  /**
   * The truthful landing state:
   *  • published    — a green `publish` truth-gate produced a verified live URL (§5.1);
   *  • draft-saved  — drafts saved, not published (offers the D1 confirmation chip);
   *  • draft-unsaved / failed / stopped — as before.
   */
  state: 'published' | 'draft-saved' | 'draft-unsaved' | 'failed' | 'stopped';
  files: ReportFile[];
  unitsConsumed: number;
  /** The model's finish() report text (or last narration), quoted — never treated as truth. */
  modelText: string;
  /**
   * One-tap follow-ups the card offers. 'confirm-publish' is the D1 chip
   * ("Bereit — jetzt veröffentlichen?"): one tap grants + resumes a publish-only run.
   */
  followUps: Array<'view-changes' | 'go-live' | 'open' | 'confirm-publish'>;
  /** The verified live URL when state === 'published' (attested by the truth-gate). */
  publishedUrl?: string;
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
  /** FEEL-3b B3: how many corrective (self-heal) cycles the run spent (0–2). */
  healCycles: number;
  tokensIn: number;
  tokensOut: number;
  unitsConsumed: number;
}
