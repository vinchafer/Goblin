/**
 * FINAL-POLISH · U1 — the phone-lock defect, as a test.
 *
 * The founder's walk: start a chat turn on the iPhone, switch to the PC, the phone
 * auto-locks. iOS suspends the PWA and the SSE socket drops. On return the answer was
 * gone and the UI said "die Verbindung hat kurz gehakt — bitte versuch es erneut".
 *
 * Root cause (pre-fix): `chat-sessions.ts` aborted the upstream model stream on
 * `c.req.raw.signal`, the loop hit `if (abortController.signal.aborted) break`, and the
 * persistence branch — which lives INSIDE the `done` case — was never reached. The turn's
 * tokens were spent and the answer was thrown away.
 *
 * These tests are a falsification of exactly that: the model generator here honours the
 * signal it is handed, the way a real upstream does. Under the old code the mid-turn
 * disconnect leaves NO assistant row; under the fix the turn runs on and persists in full.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Captured DB writes ───────────────────────────────────────────────────────
interface Captured {
  assistantInserts: Array<{ content: string; session_id: string }>;
  userInserts: Array<{ content: string }>;
}
const captured: Captured = { assistantInserts: [], userInserts: [] };

// ─── A minimal, chainable Supabase stand-in ───────────────────────────────────
// Every builder method returns the builder; `then`/`single` resolve against the
// (table, operation) pair. Unknown tables resolve empty rather than throwing, so
// incidental lookups (user preferences) stay out of the way.
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
      // head+count → the auto-title probe; otherwise the history read.
      const opts = state.selectArgs[1] as { head?: boolean } | undefined;
      if (opts?.head) return Promise.resolve({ count: 1, error: null });
      return Promise.resolve({ data: [{ role: 'user', content: 'Bau mir eine Todo-App' }], error: null });
    }
    return Promise.resolve(single ? { data: null, error: null } : { data: [], error: null, count: 0 });
  };

  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'order', 'limit', 'in']) {
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

// ─── A step-gated model stream ────────────────────────────────────────────────
// Yields `meta`, then a first delta, then BLOCKS on a gate the test opens after it
// has severed the client — so the disconnect lands strictly mid-turn. It honours the
// signal it is given, exactly as the real upstream generator does.
let gate: { promise: Promise<void>; open: () => void };
const newGate = () => {
  let open!: () => void;
  const promise = new Promise<void>((r) => { open = r; });
  return { promise, open };
};
let sawSignalAbort = false;

vi.mock('../services/token-limit-retry.js', () => ({
  streamWithReducedContextRetry: async function* (opts: { params: { signal: AbortSignal } }) {
    const signal = opts.params.signal;
    yield JSON.stringify({ type: 'meta', model: 'goblin-swift', source_tier: 'hosted' });
    yield JSON.stringify({ type: 'delta', content: 'Klar, ' });
    await gate.promise;
    if (signal.aborted) { sawSignalAbort = true; return; } // a real upstream stops here
    yield JSON.stringify({ type: 'delta', content: 'ich baue dir das.' });
    yield JSON.stringify({ type: 'done' });
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

const { chatSessions, chatMaxRuntimeMs } = await import('./chat-sessions');

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
  gate = newGate();
  sawSignalAbort = false;
});

describe('U1 — a chat turn survives the phone locking', () => {
  it('persists the FULL answer when the client disconnects mid-turn (the founder walk)', async () => {
    const ac = new AbortController();
    const res = await chatSessions.request('/sess-1/stream', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ message: 'Bau mir eine Todo-App' }),
      signal: ac.signal,
    });
    expect(res.status).toBe(200);

    // The user's message is on record before a single token streams.
    await waitFor(() => captured.userInserts.length === 1);

    // The phone locks: iOS suspends the PWA, the SSE socket drops.
    ac.abort();
    // Only now does the model produce the rest of the turn.
    gate.open();

    // The run continued server-side and the answer was persisted in full.
    await waitFor(() => captured.assistantInserts.length === 1);
    expect(captured.assistantInserts[0].content).toBe('Klar, ich baue dir das.');
    expect(captured.assistantInserts[0].session_id).toBe('sess-1');

    // The disconnect must NOT have reached the upstream generator. This is the
    // assertion that fails on the pre-fix code, where the request signal was wired
    // straight into the model stream's controller.
    expect(sawSignalAbort).toBe(false);
  });

  it('still streams and persists normally when the client stays connected', async () => {
    gate.open(); // no disconnect — let the turn run straight through
    const res = await chatSessions.request('/sess-1/stream', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ message: 'Bau mir eine Todo-App' }),
    });
    expect(res.status).toBe(200);
    const body = await res.text();

    expect(body).toContain('"type":"meta"');
    expect(body).toContain('ich baue dir das.');
    expect(body).toContain('"messageId":"asst-1"');
    expect(captured.assistantInserts).toHaveLength(1);
    expect(captured.assistantInserts[0].content).toBe('Klar, ich baue dir das.');
  });

  it('bounds an abandoned turn instead of letting it run forever', () => {
    // The guard that replaces the old disconnect-abort. Default well above a normal
    // chat turn, and overridable the same way the agent guard is.
    expect(chatMaxRuntimeMs()).toBe(120_000);
    process.env.CHAT_MAX_RUNTIME_MS = '5000';
    expect(chatMaxRuntimeMs()).toBe(5000);
    delete process.env.CHAT_MAX_RUNTIME_MS;
  });
});
