// U3 (feel-sprint-2): per-project rolling memory. loadProjectState feeds the
// chat system prompt ("Bisheriger Stand & Entscheidungen"); after each
// completed assistant turn the route fires scheduleProjectStateUpdate — an
// async, budget-capped summarization that MERGES the new turn into the stored
// state. Every failure here is silent-logged and never user-visible; a
// pre-migration DB (table 0076 missing) makes the whole feature a clean no-op.

import type { SupabaseClient } from '@supabase/supabase-js';
import { streamCompletionGuarded } from './model-router';
import {
  buildProjectStateSummarizerPrompt,
  PROJECT_STATE_MAX_SUMMARY_CHARS,
  PROJECT_STATE_MAX_DECISIONS_CHARS,
  type ProjectState,
} from '../prompts/project-state-summarizer';

// B1 (feel-sprint-2b): the summarizer is pinned to the Goblin-hosted efficient
// tier — without an explicit model the router's default slug may not resolve in
// every environment (local free-key routing 404'd on 'llama-3.3-70b'), silently
// never populating state. Where hosted routing is unavailable the router falls
// through and the call fails silently as before (no user impact) — the error
// log below names the attempted model so the miss is diagnosable.
const SUMMARIZER_MODEL = 'goblin/efficient';

// Hard caps so a runaway model can't grow the state or the request unbounded.
const MAX_RAW_OUTPUT_CHARS = 4000; // ~300 output tokens of JSON, generously
const MAX_USER_MSG_CHARS = 2000;
const MAX_ASSISTANT_MSG_CHARS = 6000;

function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)} …` : s;
}

/** Stored state for a project, or null (absent row OR pre-migration table). */
export async function loadProjectState(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectState | null> {
  try {
    const { data, error } = await supabase
      .from('project_state')
      .select('summary, decisions')
      .eq('project_id', projectId)
      .maybeSingle();
    if (error || !data) return null; // missing table errors land here → no-op
    const summary = typeof data.summary === 'string' ? data.summary : '';
    const decisions = typeof data.decisions === 'string' ? data.decisions : '';
    return summary || decisions ? { summary, decisions } : null;
  } catch {
    return null;
  }
}

/** Extract the {"summary","decisions"} object from raw model output. */
function parseStateJson(raw: string): ProjectState | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as { summary?: unknown; decisions?: unknown };
    const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
    const decisions = typeof obj.decisions === 'string' ? obj.decisions.trim() : '';
    if (!summary && !decisions) return null;
    return {
      summary: clip(summary, PROJECT_STATE_MAX_SUMMARY_CHARS),
      decisions: clip(decisions, PROJECT_STATE_MAX_DECISIONS_CHARS),
    };
  } catch {
    return null;
  }
}

async function updateProjectState(opts: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  userMessage: string;
  assistantMessage: string;
}): Promise<void> {
  const { supabase, userId, projectId } = opts;
  const prev = await loadProjectState(supabase, projectId);
  const systemPrompt = buildProjectStateSummarizerPrompt(prev);
  const message = `Letzte Nutzer-Nachricht:\n${clip(opts.userMessage, MAX_USER_MSG_CHARS)}\n\nLetzte Antwort:\n${clip(opts.assistantMessage, MAX_ASSISTANT_MSG_CHARS)}`;

  let raw = '';
  for await (const jsonToken of streamCompletionGuarded({
    userId,
    projectId,
    message,
    chatHistory: [],
    modelPreference: SUMMARIZER_MODEL,
    supabase,
    systemPrompt,
    // B5 (feel-sprint-2): this is a server-initiated platform feature, not a user
    // turn. Bill its tokens as platform COGS — exempt from the user allowance gate
    // and excluded from the user's usage counters (see model-router internalBilling).
    internalBilling: true,
  })) {
    const parsed = JSON.parse(jsonToken) as { type?: string; content?: string; message?: string };
    if (parsed.type === 'delta') raw += parsed.content ?? '';
    if (parsed.type === 'error') {
      console.warn(`[project-state] summarizer errored (model ${SUMMARIZER_MODEL}):`, parsed.message);
      return;
    }
    if (raw.length > MAX_RAW_OUTPUT_CHARS) break; // budget guard
  }

  const state = parseStateJson(raw);
  if (!state) {
    console.warn('[project-state] summarizer output not parseable — state unchanged');
    return;
  }

  const { error } = await supabase.from('project_state').upsert({
    project_id: projectId,
    summary: state.summary,
    decisions: state.decisions,
    updated_at: new Date().toISOString(),
  });
  // Pre-migration (table missing) or transient DB errors: silent-log only.
  if (error) console.warn('[project-state] upsert failed:', error.message);
}

/**
 * Fire-and-forget wrapper the chat routes call after persisting a completed
 * assistant turn. Never throws, never blocks the response stream.
 */
export function scheduleProjectStateUpdate(opts: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  userMessage: string;
  assistantMessage: string;
}): void {
  if (!opts.projectId || !opts.assistantMessage.trim()) return;
  void updateProjectState(opts).catch((err) => {
    console.warn('[project-state] update failed:', err instanceof Error ? err.message : String(err));
  });
}

export type { ProjectState };
