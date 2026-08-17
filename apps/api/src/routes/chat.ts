import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { createClient } from '@supabase/supabase-js';
import { streamWithAutoContinuation, buildContinuationPrompt, stitch } from '../services/stream-continuation';
import { buildGoblinChatSystemPrompt, REDUCED_CONTEXT_NOTE } from '../prompts/goblin-chat-system';
import { listFilesWithMeta } from '../services/file-storage';
import { loadProjectContextFiles, isSoftDeletedPath } from '../services/project-context';
import { loadProjectState, scheduleProjectStateUpdate } from '../services/project-state';
import { loadUserPreferences } from '../services/user-preferences';
import { authMiddleware } from '../middleware/auth';
import { chatStreamRateLimit } from '../middleware/rate-limit';
import { trackEvent } from '../lib/platform-events';
import { scrubString } from '../lib/scrub-secrets';
import { runChatWebSearch } from '../services/search/augment';

type Variables = { userId: string }
const chat = new Hono<{ Variables: Variables }>();

chat.use('*', authMiddleware);

chat.get('/:projectId/history', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (!project) return c.json({ error: 'Project not found' }, 404);

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) return c.json({ error: 'Failed to fetch history' }, 500);

  return c.json(data || []);
});

// HR-3 (DD §A): the per-minute burst guard stays; the legacy monthly REQUEST-COUNT
// cap (usageLimitMiddleware) is retired. It wrongly 200-capped BYOK (the user's own
// key) and goblin_hosted (already governed by the weighted token allowance + daily
// guard in model-router.ts), and only ever applied here — standalone chat had no
// such cap, so it was bypassable theatre. Goblin spend stays capped by the weighted
// allowance; BYOK has no Goblin-imposed limit, matching the UI promise.
chat.post('/stream', chatStreamRateLimit, async (c) => {
  const userId = c.get('userId');
  const { projectId, message, modelSlug, clientMessageId, websearch, continueTruncated } = await c.req.json();
  // TRUNC-1: the one-tap "Fortsetzen" after a cut-off answer. Writes no user message,
  // hands the model its own partial answer back, and APPENDS the result to it — the
  // opposite of the regenerate the tester got when he asked for the rest.
  const isContinuation = continueTruncated === true;
  // F-43: the "Websuche" toggle. When ON, this send is routed through the real
  // search service (search-augmented generation) instead of a tool-less
  // completion — the toggle actually searches, or honestly reports it couldn't.
  const wantsWebSearch = websearch === true;

  if (!projectId || (!message && !isContinuation)) {
    return c.json({ error: 'Missing parameters' }, 400);
  }
  // Optional idempotency key (P0.5). Validated as a UUID so it can't smuggle
  // arbitrary strings into the DB filter below.
  const clientMsgId: string | null =
    typeof clientMessageId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientMessageId)
      ? clientMessageId
      : null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify project ownership — prevents IDOR (any user writing to any project)
  const { data: projectCheck } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (!projectCheck) return c.json({ error: 'Project not found' }, 404);

  // Idempotent replay (P0.5): a retry of a send whose response the client never
  // saw carries the same clientMessageId. If that message is already persisted,
  // do NOT insert it again — the model must never receive one send twice.
  // Tolerant of a pre-migration DB (0075): a missing column errors the SELECT,
  // which we treat as "no duplicate found".
  let alreadyPersisted = isContinuation; // a continuation writes no user message at all
  if (clientMsgId && !isContinuation) {
    try {
      const { data: dup, error: dupErr } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('project_id', projectId)
        .eq('client_msg_id', clientMsgId)
        .limit(1);
      alreadyPersisted = !dupErr && Array.isArray(dup) && dup.length > 0;
    } catch { /* pre-migration — proceed without dedupe */ }
  }

  // Save user message
  if (!alreadyPersisted) {
    const baseRow = { project_id: projectId, role: 'user', content: message };
    // Insert with client_msg_id when provided; retry without it if the column
    // doesn't exist yet (migration 0075 not applied).
    let userInsertErr = clientMsgId
      ? (await supabase.from('chat_messages').insert({ ...baseRow, client_msg_id: clientMsgId })).error
      : (await supabase.from('chat_messages').insert(baseRow)).error;
    if (userInsertErr && clientMsgId) {
      // 23505 = concurrent duplicate retry — treat as already persisted, not an error.
      if (userInsertErr.code === '23505') {
        userInsertErr = null;
      } else {
        userInsertErr = (await supabase.from('chat_messages').insert(baseRow)).error;
      }
    }
    if (userInsertErr) {
      // Persistence failure here means the next turn loses this message → broken
      // conversation memory. Surface it loudly instead of failing silently.
      console.error('[chat] failed to persist user message:', userInsertErr.message);
    }
    // I1 funnel: message_sent (metadata only — NEVER the message text). One event
    // per fresh user turn (idempotent replays set alreadyPersisted); the dashboard
    // takes the first-per-user timestamp for the first_message_sent stage.
    trackEvent({ eventType: 'message_sent', userId, projectId, meta: { surface: 'project' } });
  }

  // Get chat history. We just inserted the user message above, so the most
  // recent row is THIS turn's message — drop it: the model-router appends
  // `message` itself, and including it here would duplicate the last user turn.
  const { data: chatHistoryRows, error: historyErr } = await supabase
    .from('chat_messages')
    .select('id, role, content')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(50);
  if (historyErr) console.error('[chat] failed to load history:', historyErr.message);

  // TRUNC-1: on a continuation the last row is the cut-off ASSISTANT message. It STAYS in
  // history — that is what makes the next tokens continue it — and its id is where the
  // continuation is appended.
  const rows = (chatHistoryRows ?? []) as Array<{ id?: string; role?: string; content?: string }>;
  const tailRow = rows[rows.length - 1];
  const partialAssistant = isContinuation && tailRow?.role === 'assistant' ? tailRow : null;
  if (isContinuation && !partialAssistant) {
    return c.json({ error: 'Es gibt keine abgeschnittene Antwort, die ich fortsetzen könnte.' }, 409);
  }
  const chatHistory = (isContinuation ? rows : rows.slice(0, -1))
    .map((m) => ({ role: m.role as string, content: m.content as string }));
  const turnMessage = partialAssistant
    ? buildContinuationPrompt(partialAssistant.content ?? '')
    : (message as string);

  // F1.1 — Goblin identity + real project context. Best-effort lookups.
  let systemPrompt: string;
  // B2: fallback prompt (names+sizes only) for the token-limit retry; only set
  // when file contents were actually injected.
  let reducedSystemPrompt: string | undefined;
  try {
    const { data: proj } = await supabase
      .from('projects')
      .select('name, preview_url, last_deployed_at, instructions')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    // U1: file CONTENTS (budget-capped) — falls back to the bare name+size
    // list if the content loader hiccups.
    const files = await loadProjectContextFiles(projectId).catch(async () =>
      // B6: mirror the soft-delete exclusion on the degraded fallback path too.
      (await listFilesWithMeta(projectId).catch(() => []))
        .filter((f) => !isSoftDeletedPath(f.path))
        .map((f) => ({ path: f.path, size: f.size })),
    );
    const p = proj as { name?: string; preview_url?: string | null; last_deployed_at?: string | null; instructions?: string | null } | null;
    const promptCtx = {
      projectName: p?.name ?? null,
      files,
      lastDeploy: p ? { url: p.preview_url ?? null, deployedAt: p.last_deployed_at?.slice(0, 10) ?? null } : null,
      // U3: rolling memory — null pre-migration / when nothing stored yet.
      projectState: await loadProjectState(supabase, projectId),
      // F4.1: user-authored project instructions (empty/absent → not rendered).
      projectInstructions: p?.instructions ?? null,
      // F4.2: global user preferences (custom instructions live; pref_* dark pre-0082).
      userPreferences: await loadUserPreferences(supabase, userId),
    };
    systemPrompt = buildGoblinChatSystemPrompt(promptCtx);
    if (files.some((f) => 'content' in f && f.content != null)) {
      reducedSystemPrompt = buildGoblinChatSystemPrompt({
        ...promptCtx,
        files: files.map((f) => ({ path: f.path, size: f.size, notLoaded: 'notLoaded' in f ? f.notLoaded : undefined })),
        contextNote: REDUCED_CONTEXT_NOTE,
      });
    }
  } catch {
    systemPrompt = buildGoblinChatSystemPrompt();
  }

  return streamSSE(c, async (stream) => {
    let fullResponse = '';
    let currentModel = modelSlug || 'claude-sonnet-4-6';
    let currentSourceTier = 'byok';
    const abortController = new AbortController();

    c.req.raw.signal.addEventListener('abort', () => {
      abortController.abort();
    });

    // F-43 — search-augmented generation. When the toggle is ON, run one real
    // web search BEFORE the completion and inject the hits into the system
    // context so the model answers from live sources and cites them. Fully
    // additive: off, or no provider configured → identical to the plain path.
    // A `search` SSE event lets the client show the step actually fired.
    if (wantsWebSearch) {
      try {
        const outcome = await runChatWebSearch(userId, message, abortController.signal);
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'search',
            query: outcome.query,
            ran: outcome.ran,
            results: outcome.results.length,
            source: outcome.source ?? null,
            reason: outcome.reason ?? null,
          }),
        });
        if (outcome.contextBlock) {
          // Prepend the live results to the system prompt (and its reduced
          // fallback) so both the primary and token-limit-retry paths cite them.
          systemPrompt = `${outcome.contextBlock}\n\n${systemPrompt}`;
          if (reducedSystemPrompt) reducedSystemPrompt = `${outcome.contextBlock}\n\n${reducedSystemPrompt}`;
        }
        trackEvent({
          eventType: 'chat_web_search',
          userId,
          projectId,
          meta: { ran: outcome.ran, results: outcome.results.length, reason: outcome.reason ?? null, source: outcome.source ?? null },
        });
      } catch (searchErr) {
        // Search must never break the send — degrade to a normal completion.
        console.error('[chat] web-search augmentation failed:', searchErr instanceof Error ? searchErr.message : searchErr);
      }
    }

    try {
      // TRUNC-1: auto-continuation wraps the reduced-context retry (see
      // services/stream-continuation.ts) so a ceiling cut-off is resumed, not restarted.
      for await (const jsonToken of streamWithAutoContinuation({
        params: {
          userId,
          projectId,
          message: turnMessage,
          chatHistory: chatHistory || [],
          modelPreference: modelSlug,
          supabase,
          signal: abortController.signal,
        },
        systemPrompt,
        reducedSystemPrompt,
      })) {
        if (abortController.signal.aborted) break;

        const parsed = JSON.parse(jsonToken);

        // Meta event — routing info, send as-is
        if (parsed.type === 'meta') {
          currentModel = parsed.model;
          currentSourceTier = parsed.source_tier;
          await stream.writeSSE({
            data: JSON.stringify(parsed),
          });
          continue;
        }

        // Delta event — token content
        if (parsed.type === 'delta') {
          fullResponse += parsed.content;
          await stream.writeSSE({
            data: JSON.stringify({
              type: 'delta',
              content: parsed.content,
            }),
          });
          continue;
        }

        // Error / fallback_notice — forward verbatim so the client can surface
        // it instead of spinning forever (e.g. the first-token watchdog).
        if (parsed.type === 'error' || parsed.type === 'fallback_notice') {
          await stream.writeSSE({ data: JSON.stringify(parsed) });
          if (parsed.type === 'error') return;
          continue;
        }

        // Done event
        if (parsed.type === 'done') {
          // TRUNC-1: a continuation APPENDS to the cut-off message (stitched at the joint)
          // instead of writing a second one — the transcript keeps ONE answer.
          const persistedContent = scrubString(
            partialAssistant ? stitch(partialAssistant.content ?? '', fullResponse) : fullResponse,
          );
          const { data: assistantMessage } = partialAssistant
            ? await supabase
                .from('chat_messages')
                .update({ content: persistedContent })
                .eq('id', partialAssistant.id)
                .select()
                .single()
            : await supabase
                .from('chat_messages')
                .insert({
                  project_id: projectId,
                  role: 'assistant',
                  content: persistedContent,
                  model_used: currentModel,
                  source_tier: currentSourceTier,
                })
                .select()
                .single();

          // U3: merge this completed turn into the project's rolling memory. On a
          // continuation the user said nothing new — the answer is what grew.
          scheduleProjectStateUpdate({
            supabase, userId, projectId,
            userMessage: partialAssistant ? '' : message,
            assistantMessage: persistedContent,
          });

          await stream.writeSSE({
            data: JSON.stringify({
              type: 'done',
              messageId: assistantMessage?.id,
              model_used: currentModel,
              source_tier: currentSourceTier,
              // TRUNC-1: this route builds its own `done`, so the truncation verdict has
              // to be carried across explicitly — dropping it would put the phantom
              // "looks complete" back exactly where the tester found it.
              truncated: parsed.truncated === true,
              continuation_rounds: parsed.continuation_rounds ?? 0,
              // The server trimmed the overlap at the joint; hand the client the stored
              // truth so screen and transcript agree.
              ...(partialAssistant ? { full_content: persistedContent } : {}),
            }),
          });
          return;
        }
      }

      // Fallback done if generator ends without explicit 'done'
      // TRUNC-1: this path must respect the continuation contract too — appending, not
      // inserting a second assistant message next to the one being continued.
      const fallbackContent = scrubString(
        partialAssistant ? stitch(partialAssistant.content ?? '', fullResponse) : fullResponse,
      );
      // U3: same rolling-memory update on the fallback completion path.
      scheduleProjectStateUpdate({
        supabase, userId, projectId,
        userMessage: partialAssistant ? '' : message,
        assistantMessage: fallbackContent,
      });
      const { data: assistantMessage } = partialAssistant
        ? await supabase
            .from('chat_messages')
            .update({ content: fallbackContent })
            .eq('id', partialAssistant.id)
            .select()
            .single()
        : await supabase
            .from('chat_messages')
            .insert({
              project_id: projectId,
              role: 'assistant',
              content: fallbackContent,
              model_used: currentModel,
              source_tier: currentSourceTier,
            })
            .select()
            .single();

      await stream.writeSSE({
        data: JSON.stringify({
          type: 'done',
          messageId: assistantMessage?.id,
          model_used: currentModel,
          source_tier: currentSourceTier,
          ...(partialAssistant ? { full_content: fallbackContent } : {}),
        }),
      });
    } catch (err: unknown) {
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'error',
          message: err instanceof Error ? err.message : 'Stream failed',
        }),
      });
    }
  });
});

export { chat };