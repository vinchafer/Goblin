/**
 * FOUNDER-WALK-5 · U1 — what is ACTUALLY in the database after the founder's sequence.
 *
 * The founder locked the iPhone mid-turn, came back, and read: "Deine Antwort wurde noch
 * geschrieben, als ich nachgesehen habe. Sie läuft auf dem Server zu Ende — öffne diesen
 * Chat gleich nochmal, dann steht sie da." He waited. Nothing ever appeared.
 *
 * The question that has to be settled before anything is fixed is not "why did the client
 * not refetch" — it is "was there anything to refetch". These tests answer it from the
 * server side, by running the real route against a model stream that outlives
 * `CHAT_MAX_RUNTIME_MS`:
 *
 *   ① A turn the runtime guard aborts writes NO assistant row. Not a partial one, not an
 *      empty one — none. The answer is gone, and no later refetch can produce it. That is
 *      the state the "läuft auf dem Server zu Ende" copy described as pending.
 *   ② The registry says so out loud (`lost` / `max_runtime`), which is what lets the client
 *      stop guessing.
 *   ③ A `done` frame the model already produced is NEVER discarded by the guard — the race
 *      the old `if (aborted) break` (placed before the parse) could lose.
 *   ④ The turn-status endpoint answers `unknown` — never `running` — when this process has
 *      no record. An unverifiable state must not be reported as a live one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface Captured {
  assistantInserts: Array<{ content: string; session_id: string }>;
  userInserts: Array<{ content: string }>;
}
const captured: Captured = { assistantInserts: [], userInserts: [] };

function makeBuilder(table: string) {
  const state: { op: 'select' | 'insert' | 'update'; payload: unknown; selectArgs: unknown[] } = {
    op: 'select', payload: null, selectArgs: [],
  };
  const resolve = (single: boolean): Promise<unknown> => {
    if (table === 'chat_sessions') {
      if (state.op === 'select') return Promise.resolve({ data: { id: 'sess-1', project_id: null }, error: null });
      return Promise.resolve({ data: null, error: null });
    }
    if (table === 'standalone_messages') {
      if (state.op === 'insert') {
        const row = state.payload as { role: string; content: string; session_id: string };
        if (row.role === 'assistant') {
          captured.assistantInserts.push({ content: row.content, session_id: row.session_id });
          return Promise.resolve({ data: { id: 'asst-1' }, error: null });
        }
        captured.userInserts.push({ content: row.content });
        return Promise.resolve({ data: null, error: null });
      }
      const opts = state.selectArgs[1] as { head?: boolean } | undefined;
      if (opts?.head) return Promise.resolve({ count: 1, error: null });
      return Promise.resolve({ data: [{ role: 'user', content: 'Bau mir eine Todo-App' }], error: null });
    }
    return Promise.resolve(single ? { data: null, error: null } : { data: [], error: null, count: 0 });
  };

  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'order', 'limit', 'in', 'is']) {
    builder[m] = (...args: unknown[]) => {
      if (m === 'insert') { state.op = 'insert'; state.payload = args[0]; }
      if (m === 'update') { state.op = 'update'; state.payload = args[0]; }
      if (m === 'select') state.selectArgs = args;
      return builder;
    };
  }
  builder.single = () => resolve(true);
  builder.maybeSingle = () => resolve(true);
  builder.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => resolve(false).then(res, rej);
  return builder;
}

const fakeSupabase = {
  auth: {
    getUser: (token: string) =>
      Promise.resolve(
        token?.startsWith('user:')
          ? { data: { user: { id: token.slice(5) } }, error: null }
          : { data: { user: null }, error: { message: 'bad' } },
      ),
  },
  from: (table: string) => makeBuilder(table),
};

/**
 * A model stream that behaves like a real upstream under abort: it yields a `meta` and one
 * delta, then waits — and once the signal fires it STOPS without ever emitting `done`, which
 * is exactly what an aborted provider SDK stream does (model-router only reaches its `done`
 * yield after the provider loop completes normally). `emitDoneAfterWait` flips it into the
 * race case: the answer completes at the same moment the guard fires.
 */
let emitDoneAfterWait = false;
let upstreamStopped = false;

vi.mock('../services/token-limit-retry.js', () => ({
  streamWithReducedContextRetry: async function* (opts: { params: { signal: AbortSignal } }) {
    const signal = opts.params.signal;
    yield JSON.stringify({ type: 'meta', model: 'goblin-swift', source_tier: 'hosted' });
    yield JSON.stringify({ type: 'delta', content: 'Klar, ich fange an' });
    // Outlive the guard.
    await new Promise<void>((r) => {
      if (signal.aborted) return r();
      signal.addEventListener('abort', () => r(), { once: true });
    });
    if (emitDoneAfterWait) {
      // The completion landed in the same tick the guard fired. This is a genuine model
      // completion and must survive.
      yield JSON.stringify({ type: 'delta', content: ' — und hier ist sie.' });
      yield JSON.stringify({ type: 'done' });
      return;
    }
    upstreamStopped = true; // aborted mid-answer: no `done`, ever
  },
}));

vi.mock('../lib/supabase', () => ({ getSupabaseAdmin: () => fakeSupabase }));
vi.mock('../lib/supabase.js', () => ({ getSupabaseAdmin: () => fakeSupabase }));
vi.mock('../lib/platform-events.js', () => ({ trackEvent: vi.fn() }));
vi.mock('../lib/logger', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('../services/user-preferences.js', () => ({ loadUserPreferences: async () => null }));
vi.mock('../services/project-state.js', () => ({
  loadProjectState: async () => null,
  scheduleProjectStateUpdate: vi.fn(),
}));

const { chatSessions } = await import('./chat-sessions');
const { latestChatTurn, __resetChatTurnRegistry } = await import('../services/chat-turn-registry');

const auth = { Authorization: 'Bearer user:alice', 'Content-Type': 'application/json' };

async function waitFor(cond: () => boolean, ms = 4000): Promise<void> {
  const started = Date.now();
  while (!cond()) {
    if (Date.now() - started > ms) throw new Error('timed out waiting for condition');
    await new Promise((r) => setTimeout(r, 10));
  }
}

beforeEach(() => {
  captured.assistantInserts = [];
  captured.userInserts = [];
  emitDoneAfterWait = false;
  upstreamStopped = false;
  __resetChatTurnRegistry();
  // A guard short enough to test, using the same knob production uses.
  process.env.CHAT_MAX_RUNTIME_MS = '120';
});
afterEach(() => { delete process.env.CHAT_MAX_RUNTIME_MS; });

describe('U1 — the truth about a turn the runtime guard ended', () => {
  it('writes NO assistant row: the answer the copy called "pending" does not exist', async () => {
    const ac = new AbortController();
    const res = await chatSessions.request('/sess-1/stream', {
      method: 'POST', headers: auth,
      body: JSON.stringify({ message: 'Bau mir eine Todo-App' }),
      signal: ac.signal,
    });
    expect(res.status).toBe(200);

    await waitFor(() => captured.userInserts.length === 1);
    ac.abort(); // the phone locks

    // The guard fires (120ms) and the upstream stops without a `done`.
    await waitFor(() => upstreamStopped);
    await waitFor(() => latestChatTurn('sess-1', 'alice')?.state !== 'running');

    // THE FINDING. Nothing was saved. Refetching the transcript — however often, however
    // late — can never surface this answer, because there is no answer.
    expect(captured.assistantInserts).toHaveLength(0);

    // And it is NOT quietly saved as a partial either: no half-written text is passed off
    // as the finished answer.
    expect(captured.assistantInserts.map((r) => r.content)).not.toContain('Klar, ich fange an');
  });

  it('records the turn as lost with the max_runtime reason, so nothing has to be inferred', async () => {
    const ac = new AbortController();
    await chatSessions.request('/sess-1/stream', {
      method: 'POST', headers: auth,
      body: JSON.stringify({ message: 'Bau mir eine Todo-App' }),
      signal: ac.signal,
    });
    await waitFor(() => captured.userInserts.length === 1);
    ac.abort();
    await waitFor(() => latestChatTurn('sess-1', 'alice')?.state !== 'running');

    const rec = latestChatTurn('sess-1', 'alice');
    expect(rec?.state).toBe('lost');
    expect(rec?.reason).toBe('max_runtime');
  });

  it('never discards a done frame the model already produced (the guard race)', async () => {
    emitDoneAfterWait = true;
    const ac = new AbortController();
    await chatSessions.request('/sess-1/stream', {
      method: 'POST', headers: auth,
      body: JSON.stringify({ message: 'Bau mir eine Todo-App' }),
      signal: ac.signal,
    });
    await waitFor(() => captured.userInserts.length === 1);
    ac.abort();

    // The completion arrives with the abort already signalled. Under the old
    // `if (aborted) break` — which ran before the frame was even parsed — this answer was
    // thrown away. It must be persisted, and the turn must read `completed`.
    await waitFor(() => captured.assistantInserts.length === 1);
    expect(captured.assistantInserts[0]?.content).toContain('und hier ist sie.');
    await waitFor(() => latestChatTurn('sess-1', 'alice')?.state === 'completed');
    expect(latestChatTurn('sess-1', 'alice')?.reason).toBeNull();
  });
});

describe('U1 — /turn-status reports only what it can verify', () => {
  it('answers unknown (never running) when this process has no record', async () => {
    __resetChatTurnRegistry();
    const res = await chatSessions.request('/sess-1/turn-status', { headers: auth });
    expect(res.status).toBe(200);
    const body = await res.json() as { state: string; verified: boolean };
    expect(body.state).toBe('unknown');
    expect(body.verified).toBe(false);
  });

  it('reports the lost verdict, with its reason, after the founder sequence', async () => {
    const ac = new AbortController();
    await chatSessions.request('/sess-1/stream', {
      method: 'POST', headers: auth,
      body: JSON.stringify({ message: 'Bau mir eine Todo-App' }),
      signal: ac.signal,
    });
    await waitFor(() => captured.userInserts.length === 1);
    ac.abort();
    await waitFor(() => latestChatTurn('sess-1', 'alice')?.state !== 'running');

    const res = await chatSessions.request('/sess-1/turn-status', { headers: auth });
    const body = await res.json() as { state: string; reason: string | null; verified: boolean };
    expect(body).toMatchObject({ state: 'lost', reason: 'max_runtime', verified: true });
  });
});
