import { randomUUID } from 'crypto';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { authMiddleware } from '../middleware/auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { streamWithReducedContextRetry } from '../services/token-limit-retry.js';
import { buildGoblinChatSystemPrompt, REDUCED_CONTEXT_NOTE } from '../prompts/goblin-chat-system.js';
import { listFilesWithMeta } from '../services/file-storage.js';
import { loadProjectContextFiles, isSoftDeletedPath, type ContextFile } from '../services/project-context.js';
import { loadProjectState, scheduleProjectStateUpdate } from '../services/project-state.js';
import { loadUserPreferences } from '../services/user-preferences.js';
import { truncateTitle } from '../lib/truncate-title.js';
import { trackEvent } from '../lib/platform-events.js';
import { runChatWebSearch } from '../services/search/augment.js';
import {
  beginChatTurn,
  settleChatTurn,
  latestChatTurn,
  type ChatTurnLostReason,
} from '../services/chat-turn-registry.js';

type Variables = { userId: string };
const chatSessions = new Hono<{ Variables: Variables }>();
chatSessions.use('*', authMiddleware);

/**
 * FINAL-POLISH · U1 — the abandoned-turn backstop for the standalone chat.
 *
 * A client disconnect no longer aborts the upstream model stream (that discarded answers
 * the user had already paid for — the phone-lock defect). Something must still bound a
 * turn whose reader has gone away, so this guard does what `AGENT_MAX_RUNTIME_MS` does for
 * agent runs. Two minutes is far above a normal chat turn and far below "runs forever".
 * Mirrors `agentMaxRuntimeMs()` in shape so both knobs read the same way.
 */
export function chatMaxRuntimeMs(): number {
  const raw = Number(process.env.CHAT_MAX_RUNTIME_MS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 120_000;
}

/**
 * FOUNDER-WALK-5 · U1 — how long the loop keeps reading AFTER the abort was signalled.
 *
 * An abort tells the upstream generator to stop; it does not retroactively unmake the frames
 * it already produced. A well-behaved generator ends within a tick or two of the signal, and
 * during that window it may still hand over the `done` that completes an answer. Leaving
 * immediately threw that answer away; waiting forever would defeat the guard. A few seconds
 * is both far longer than a compliant wind-down and far shorter than any real turn.
 */
export const ABORT_DRAIN_GRACE_MS = 5_000;

// GET /api/chat-sessions — list user sessions
chatSessions.get('/', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, title, model_slug, created_at, updated_at, project_id, projects(id, name)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) return c.json({ error: 'Failed to fetch sessions' }, 500);

  // Flatten joined project into project_name field
  const flat = (data ?? []).map((s: Record<string, unknown>) => {
    const proj = s.projects as { name?: string } | null;
    const { projects: _omit, ...rest } = s;
    void _omit;
    return { ...rest, project_name: proj?.name ?? null };
  });
  return c.json(flat);
});

// POST /api/chat-sessions — create new session
chatSessions.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({})) as { projectId?: string };
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ user_id: userId, project_id: body.projectId ?? null })
    .select()
    .single();

  if (error) return c.json({ error: 'Failed to create session' }, 500);
  return c.json(data, 201);
});

// GET /api/chat-sessions/:id — session + messages
chatSessions.get('/:id', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const supabase = getSupabaseAdmin();

  const { data: session, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (error || !session) return c.json({ error: 'Session not found' }, 404);

  const { data: messages } = await supabase
    .from('standalone_messages')
    .select('id, role, content, has_code, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(50);

  return c.json({ session, messages: messages ?? [] });
});

/**
 * GET /api/chat-sessions/:id/turn-status — FOUNDER-WALK-5 · U1.
 *
 * The endpoint that exists so no client ever has to infer a running turn from a missing
 * answer. Four states, and the difference between the last two is the whole point:
 *
 *   running   — a turn for this session is executing in THIS process right now. VERIFIED.
 *   completed — the answer was written; it is in `GET /api/chat-sessions/:id`.
 *   lost      — the turn ended with no answer saved. `reason: 'max_runtime'` is the
 *               CHAT_MAX_RUNTIME_MS ceiling; the work is gone and resending is the only
 *               way to get it back.
 *   unknown   — this process has no record (restart, or another replica took the turn).
 *               We do not know. Saying "läuft weiter" here would be the same false claim
 *               in a new place, so the client renders honest uncertainty instead.
 *
 * Ownership-scoped twice: the session must belong to the caller AND the registry record is
 * matched on `userId`, so a forged session id can never reveal another user's turn.
 */
chatSessions.get('/:id/turn-status', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const supabase = getSupabaseAdmin();

  const { data: session } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!session) return c.json({ error: 'Session not found' }, 404);

  const rec = latestChatTurn(sessionId, userId);
  if (!rec) {
    return c.json({ state: 'unknown', reason: null, verified: false, maxRuntimeMs: chatMaxRuntimeMs() });
  }
  return c.json({
    state: rec.state,
    reason: rec.reason,
    // `verified: true` is the client's licence to make a claim about this turn. It is only
    // ever set when a record exists — never derived from silence.
    verified: true,
    startedAt: new Date(rec.startedAt).toISOString(),
    endedAt: rec.endedAt === null ? null : new Date(rec.endedAt).toISOString(),
    maxRuntimeMs: chatMaxRuntimeMs(),
  });
});

// POST /api/chat-sessions/:id/stream — stream a message (SSE)
chatSessions.post('/:id/stream', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const { message, modelSlug, clientMessageId, websearch } = await c.req.json() as {
    message: string; modelSlug?: string; clientMessageId?: string; websearch?: boolean;
  };
  // F-43: the "Websuche" toggle — route this send through the real search service.
  const wantsWebSearch = websearch === true;

  if (!message?.trim()) return c.json({ error: 'Missing message' }, 400);
  // Optional idempotency key (P0.5) — UUID-validated so it can't smuggle
  // arbitrary strings into the DB filter.
  const clientMsgId =
    typeof clientMessageId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientMessageId)
      ? clientMessageId
      : null;

  const supabase = getSupabaseAdmin();

  const { data: session } = await supabase
    .from('chat_sessions')
    .select('id, project_id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (!session) return c.json({ error: 'Session not found' }, 404);

  // Idempotent replay (P0.5): a retry of a send whose response the client never
  // saw carries the same clientMessageId — never insert (and never let the model
  // see) the same message twice. Tolerant of a pre-migration DB (0075): a
  // missing column errors the SELECT → treated as "no duplicate".
  let alreadyPersisted = false;
  if (clientMsgId) {
    try {
      const { data: dup, error: dupErr } = await supabase
        .from('standalone_messages')
        .select('id')
        .eq('session_id', sessionId)
        .eq('client_msg_id', clientMsgId)
        .limit(1);
      alreadyPersisted = !dupErr && Array.isArray(dup) && dup.length > 0;
    } catch { /* pre-migration — proceed without dedupe */ }
  }

  // Save user message. A failure here (e.g. the standalone_messages table
  // missing — the Sprint 10.11 root cause) silently breaks conversation memory:
  // the history fetch below returns nothing and every turn looks like turn 1.
  // Never swallow it.
  if (!alreadyPersisted) {
    const baseRow = { session_id: sessionId, role: 'user', content: message };
    let userMsgErr = clientMsgId
      ? (await supabase.from('standalone_messages').insert({ ...baseRow, client_msg_id: clientMsgId })).error
      : (await supabase.from('standalone_messages').insert(baseRow)).error;
    if (userMsgErr && clientMsgId) {
      if (userMsgErr.code === '23505') {
        // Concurrent duplicate retry — the first insert won; not an error.
        userMsgErr = null;
      } else {
        // Column may not exist pre-migration — retry without the id.
        userMsgErr = (await supabase.from('standalone_messages').insert(baseRow)).error;
      }
    }
    if (userMsgErr) {
      console.error('[chat-sessions] failed to persist user message:', userMsgErr.message);
      return c.json({ error: 'Chat-Speicher nicht verfügbar — bitte später erneut versuchen.' }, 503);
    }
    // I1 funnel: message_sent (metadata only — NEVER the message text). One event
    // per fresh user turn; the dashboard's first-per-user timestamp feeds the
    // first_message_sent stage.
    trackEvent({ eventType: 'message_sent', userId, meta: { surface: 'standalone' } });
  }

  // Auto-title from first user message
  const { count } = await supabase
    .from('standalone_messages')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('role', 'user');

  if ((count ?? 0) <= 1) {
    const title = truncateTitle(message, 60);
    await supabase.from('chat_sessions')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', sessionId);
  } else {
    await supabase.from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);
  }

  // Get conversation history
  const { data: history, error: historyErr } = await supabase
    .from('standalone_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(50);
  if (historyErr) console.error('[chat-sessions] failed to load history:', historyErr.message);

  const chatHistory = (history ?? [])
    .slice(0, -1) // exclude the message we just inserted
    .map(m => ({ role: m.role, content: m.content }));

  // F1.1 — Goblin identity + real project context (name, file list, last
  // deploy). All lookups best-effort: a storage hiccup must never block chat.
  const projectId: string | null = (session as { project_id?: string | null }).project_id ?? null;
  let projectName: string | null = null;
  let projectFiles: ContextFile[] | undefined;
  let lastDeploy: { url: string | null; deployedAt: string | null } | null = null;
  let projectInstructions: string | null = null;
  if (projectId) {
    try {
      const { data: proj } = await supabase
        .from('projects')
        .select('name, preview_url, last_deployed_at, instructions')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single();
      if (proj) {
        projectName = (proj as { name: string }).name;
        const p = proj as { preview_url: string | null; last_deployed_at: string | null; instructions: string | null };
        lastDeploy = { url: p.preview_url, deployedAt: p.last_deployed_at?.slice(0, 10) ?? null };
        projectInstructions = p.instructions ?? null;
      }
      // U1: file CONTENTS (budget-capped) — falls back to name+size only.
      projectFiles = await loadProjectContextFiles(projectId).catch(async () =>
        // B6: mirror the soft-delete exclusion on the degraded fallback path too.
        (await listFilesWithMeta(projectId))
          .filter((f) => !isSoftDeletedPath(f.path))
          .map((f) => ({ path: f.path, size: f.size })),
      );
    } catch { /* context stays minimal */ }
  }
  const promptCtx = {
    projectName,
    files: projectFiles,
    lastDeploy,
    // U3: rolling memory — null pre-migration / when nothing stored yet.
    projectState: projectId ? await loadProjectState(supabase, projectId) : null,
    // F4.1: user-authored project instructions (empty/absent → not rendered).
    projectInstructions,
    // F4.2: global user preferences — injected in project AND standalone chats.
    userPreferences: await loadUserPreferences(supabase, userId),
  };
  let systemPrompt = buildGoblinChatSystemPrompt(promptCtx);
  // B2: fallback prompt (names+sizes only) for the token-limit retry; only set
  // when file contents were actually injected.
  let reducedSystemPrompt = projectFiles?.some((f) => f.content != null)
    ? buildGoblinChatSystemPrompt({
        ...promptCtx,
        files: projectFiles.map((f) => ({ path: f.path, size: f.size, notLoaded: f.notLoaded })),
        contextNote: REDUCED_CONTEXT_NOTE,
      })
    : undefined;

  return streamSSE(c, async (stream) => {
    let fullResponse = '';
    let currentModel = modelSlug ?? '';
    let currentSourceTier = '';

    // WAVE-H · H3 (#15): the upstream model stream gets its own controller, and the
    // teardown is symmetric — the controller is aborted on EVERY exit path (done, error,
    // guard) so the upstream completion generator is always signalled to close and no
    // server-side stream is left open after the client has its `done`.
    //
    // FINAL-POLISH · U1: a client disconnect no longer aborts that controller. Goblin is
    // phone-first: an iPhone locks within a minute, iOS suspends the PWA, and the SSE
    // socket drops. The old code aborted the model stream on `c.req.raw.signal` and broke
    // out of the loop BEFORE the persistence branch below, so the answer the user had
    // already paid for was discarded and the client showed a vague "try again". Now a
    // disconnect only stops the WRITES (`clientGone`); the turn runs to completion and
    // persists, so the answer is there when they come back. Same architecture as the F-40
    // agent registry: a disconnect is not a stop.
    const abortController = new AbortController();
    let clientGone = false;
    const onReqAbort = () => { clientGone = true; };
    c.req.raw.signal.addEventListener('abort', onReqAbort);

    // FOUNDER-WALK-5 · U1 — this turn's fate, on the record.
    //
    // Everything below settles this exactly once, and the `finally` catches every path that
    // did not. Without it the only server-side trace of an aborted turn was its ABSENCE from
    // `standalone_messages` — indistinguishable from a turn still being written, which is
    // precisely the ambiguity the client resolved in the flattering direction.
    const turnId = randomUUID();
    beginChatTurn({ turnId, sessionId, userId });
    let persisted = false;

    // The backstop that replaces the disconnect-abort: an abandoned turn must still be
    // bounded, or a dropped socket could leave an upstream generator running indefinitely.
    //
    // U1: `guardFired` is kept separately from `signal.aborted` because the two answer
    // different questions. The signal says "stop pulling from upstream"; `guardFired` says
    // "this turn hit its ceiling and its answer, if any, is NOT trustworthy as complete".
    let guardFired = false;
    /** When the abort was first observed by the read loop — the drain window's origin. */
    let abortedAt: number | null = null;
    const guard = setTimeout(() => {
      guardFired = true;
      if (!abortController.signal.aborted) abortController.abort();
    }, chatMaxRuntimeMs());
    guard.unref?.();

    /**
     * The one write path. Once the client is gone every write is skipped (writing to a
     * closed SSE stream throws, and that throw would land in the catch below and replace
     * a perfectly good turn with an error frame). A failed write means the socket died
     * without the abort event — treat it exactly like a disconnect.
     */
    const send = async (payload: unknown): Promise<void> => {
      if (clientGone) return;
      try {
        await stream.writeSSE({ data: JSON.stringify(payload) });
      } catch {
        clientGone = true;
      }
    };

    // F-43 — search-augmented generation (same real search path as the project
    // chat). When the "Websuche" toggle is ON, run one live search and inject the
    // hits so the base chat also answers from sources and cites them. Additive:
    // off / no provider → identical to the plain completion.
    if (wantsWebSearch) {
      try {
        const outcome = await runChatWebSearch(userId, message, abortController.signal);
        await send({
          type: 'search',
          query: outcome.query,
          ran: outcome.ran,
          results: outcome.results.length,
          source: outcome.source ?? null,
          reason: outcome.reason ?? null,
        });
        if (outcome.contextBlock) {
          systemPrompt = `${outcome.contextBlock}\n\n${systemPrompt}`;
          if (reducedSystemPrompt) reducedSystemPrompt = `${outcome.contextBlock}\n\n${reducedSystemPrompt}`;
        }
        trackEvent({
          eventType: 'chat_web_search',
          userId,
          meta: { surface: 'standalone', ran: outcome.ran, results: outcome.results.length, reason: outcome.reason ?? null, source: outcome.source ?? null },
        });
      } catch (searchErr) {
        console.error('[chat-sessions] web-search augmentation failed:', searchErr instanceof Error ? searchErr.message : searchErr);
      }
    }

    try {
      for await (const jsonToken of streamWithReducedContextRetry({
        params: {
          userId,
          projectId,
          chatSessionId: sessionId,
          message,
          chatHistory,
          modelPreference: modelSlug,
          supabase,
          signal: abortController.signal,
        },
        systemPrompt,
        reducedSystemPrompt,
      })) {
        const parsed = JSON.parse(jsonToken) as Record<string, unknown>;

        // U1 — the guard bounds the RUN; it does not invalidate work already delivered.
        //
        // The old check sat BEFORE the parse and broke out on ANY aborted signal, so a
        // completion the model had already produced could be thrown away by a timer that
        // fired in the gap between the generator yielding and this loop body running (Node
        // resumes a `for await` at an await point — exactly where a pending timer runs).
        //
        // The abort is a signal to the UPSTREAM to stop producing, so the honest response
        // here is to let the generator wind down and honour whatever it has already handed
        // over — including a trailing `done`, which model-router emits ONLY after the
        // provider stream completed normally, so it can never be a truncated answer dressed
        // up as a whole one. Dropping the deltas but keeping such a `done` would be worse
        // than either: it would persist a half answer AS the finished one.
        //
        // The bound on that goodwill is `ABORT_DRAIN_GRACE_MS`: a generator that ignores its
        // signal gets a few seconds, then the loop leaves regardless.
        if (abortController.signal.aborted) {
          if (abortedAt === null) abortedAt = Date.now();
          if (Date.now() - abortedAt > ABORT_DRAIN_GRACE_MS) break;
        }

        if (parsed.type === 'meta') {
          currentModel = (parsed.model as string) || currentModel;
          currentSourceTier = (parsed.source_tier as string) || '';
          await send(parsed);
          continue;
        }

        if (parsed.type === 'delta') {
          fullResponse += (parsed.content as string) ?? '';
          await send(parsed);
          continue;
        }

        if (parsed.type === 'done' || parsed.type === 'fallback_notice' || parsed.type === 'error') {
          if (parsed.type === 'done' && fullResponse) {
            const hasCode = fullResponse.includes('```');
            const { data: savedMsg, error: asstErr } = await supabase
              .from('standalone_messages')
              .insert({
                session_id: sessionId,
                role: 'assistant',
                content: fullResponse,
                has_code: hasCode,
              })
              .select('id')
              .single();
            if (asstErr) console.error('[chat-sessions] failed to persist assistant message:', asstErr.message);
            // U1: the verdict the client reads. `completed` is claimed only from HERE —
            // the one line in this file that puts an answer in the transcript — and a
            // failed insert settles `lost`, because a turn whose answer nobody can read
            // is lost however cleanly the model finished.
            if (asstErr) {
              settleChatTurn(turnId, 'lost', 'persist_failed');
            } else {
              settleChatTurn(turnId, 'completed');
            }
            persisted = true;

            await supabase.from('chat_sessions')
              .update({ model_slug: currentModel, updated_at: new Date().toISOString() })
              .eq('id', sessionId);

            // U3: merge this completed turn into the project's rolling memory.
            if (projectId) {
              scheduleProjectStateUpdate({ supabase, userId, projectId, userMessage: message, assistantMessage: fullResponse });
            }

            await send({
              ...parsed,
              messageId: savedMsg?.id,
              model_used: currentModel,
              source_tier: currentSourceTier,
            });
          } else {
            await send(parsed);
          }
          return;
        }

        await send(parsed);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Streaming failed';
      await send({ type: 'error', message: msg });
    } finally {
      // H3 (#15): symmetric teardown on every exit — detach the request listener and abort
      // the upstream model stream so nothing stays open server-side after the client's `done`.
      // U1: also clear the abandoned-turn guard so a completed turn leaves no pending timer.
      clearTimeout(guard);
      c.req.raw.signal.removeEventListener('abort', onReqAbort);
      if (!abortController.signal.aborted) abortController.abort();
      // U1 — the catch-all verdict. `settleChatTurn` is monotonic, so this cannot overwrite
      // the `completed` written above; it only names the turns that left WITHOUT an answer.
      // `max_runtime` is the founder's case: the 120s guard ended a turn that had produced
      // text but never a `done`, and that text is NOT saved — persisting it would be passing
      // a half-written answer off as the finished one.
      if (!persisted) {
        const reason: ChatTurnLostReason = guardFired ? 'max_runtime' : 'stream_failed';
        settleChatTurn(turnId, 'lost', reason);
        console.warn(
          `[chat-sessions] turn ended without an answer (session=${sessionId} reason=${reason} chars_discarded=${fullResponse.length})`,
        );
      }
    }
  });
});

// PATCH /api/chat-sessions/:id — update title
chatSessions.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const { title } = await c.req.json() as { title: string };
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('chat_sessions')
    .update({ title })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) return c.json({ error: 'Failed to update' }, 500);
  return c.json({ success: true });
});

// PATCH /api/chat-sessions/:id/move — set or clear the project link.
// body { projectId: string | null } — null = "Kein Projekt" (standalone).
// Ownership-scoped on the chat AND on the target project: you can only move your
// own chat, and only into a project you own (else a forged target id would let a
// chat reference a foreign project).
chatSessions.patch('/:id/move', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const body = await c.req.json().catch(() => ({})) as { projectId?: string | null };
  const projectId = body.projectId ?? null;
  const supabase = getSupabaseAdmin();

  if (projectId !== null) {
    const { data: proj } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    if (!proj) return c.json({ error: 'Target project not found' }, 404);
  }

  const { error } = await supabase
    .from('chat_sessions')
    .update({ project_id: projectId, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) return c.json({ error: 'Failed to move' }, 500);
  return c.json({ success: true });
});

// POST /api/chat-sessions/bulk-delete — delete many chats. Ownership-scoped:
// `.in('id', ids).eq('user_id', userId)` → WHERE id = ANY($ids) AND user_id = authed.
// Non-owned ids are silent no-ops (no IDOR). standalone_messages cascade via FK.
chatSessions.post('/bulk-delete', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({})) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : [];
  if (ids.length === 0) return c.json({ error: 'Invalid input' }, 400);
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .in('id', ids)
    .eq('user_id', userId);

  if (error) return c.json({ error: 'Failed to delete' }, 500);
  return c.json({ success: true });
});

// POST /api/chat-sessions/bulk-move — move many chats to a project (or null).
// Ownership-scoped on both the chats and the target project.
chatSessions.post('/bulk-move', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({})) as { ids?: unknown; projectId?: string | null };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : [];
  if (ids.length === 0) return c.json({ error: 'Invalid input' }, 400);
  const projectId = body.projectId ?? null;
  const supabase = getSupabaseAdmin();

  if (projectId !== null) {
    const { data: proj } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    if (!proj) return c.json({ error: 'Target project not found' }, 404);
  }

  const { error } = await supabase
    .from('chat_sessions')
    .update({ project_id: projectId, updated_at: new Date().toISOString() })
    .in('id', ids)
    .eq('user_id', userId);

  if (error) return c.json({ error: 'Failed to move' }, 500);
  return c.json({ success: true });
});

// POST /api/chat-sessions/:id/pin
chatSessions.post('/:id/pin', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('chat_sessions')
    .update({ pinned: true, pinned_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('user_id', userId);
  if (error) return c.json({ error: 'Failed to pin' }, 500);
  return c.json({ success: true });
});

chatSessions.post('/:id/unpin', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const supabase = getSupabaseAdmin();
  await supabase
    .from('chat_sessions')
    .update({ pinned: false, pinned_at: null })
    .eq('id', sessionId)
    .eq('user_id', userId);
  return c.json({ success: true });
});

chatSessions.post('/:id/archive', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const supabase = getSupabaseAdmin();
  await supabase
    .from('chat_sessions')
    .update({ archived: true, archived_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('user_id', userId);
  return c.json({ success: true });
});

chatSessions.post('/:id/unarchive', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const supabase = getSupabaseAdmin();
  await supabase
    .from('chat_sessions')
    .update({ archived: false, archived_at: null })
    .eq('id', sessionId)
    .eq('user_id', userId);
  return c.json({ success: true });
});

// POST /api/chat-sessions/:id/share — issue a share token (idempotent: reuses existing)
chatSessions.post('/:id/share', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from('chat_sessions')
    .select('share_token')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!existing) return c.json({ error: 'Not found' }, 404);

  let token = (existing as { share_token: string | null }).share_token;
  if (!token) {
    const { randomBytes } = await import('crypto');
    token = randomBytes(16).toString('hex');
    const { error } = await supabase
      .from('chat_sessions')
      .update({ share_token: token, share_enabled_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId);
    if (error) return c.json({ error: 'Failed to share' }, 500);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://justgoblin.com';
  return c.json({ success: true, token, url: `${appUrl}/shared/${token}` });
});

chatSessions.post('/:id/unshare', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const supabase = getSupabaseAdmin();
  await supabase
    .from('chat_sessions')
    .update({ share_token: null, share_enabled_at: null })
    .eq('id', sessionId)
    .eq('user_id', userId);
  return c.json({ success: true });
});

// Public: shared read-only view (no auth).
// Mounted at top-level /api/shared so the authMiddleware doesn't apply.

// DELETE /api/chat-sessions/:id
chatSessions.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) return c.json({ error: 'Failed to delete' }, 500);
  return c.json({ success: true });
});

export { chatSessions };
