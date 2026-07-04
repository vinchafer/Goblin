/**
 * Dictation transcription endpoint (C1) — auth, size cap, daily cap, honest
 * German failure, and the mock happy path. Exercises the real Hono router via
 * `.request()` against a fake Supabase auth and an injected transcriber — no
 * network, no DeepInfra.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const fakeSupabase = {
  auth: {
    getUser: (token: string) => {
      const id = token?.startsWith('user:') ? token.slice(5) : null;
      return Promise.resolve(
        id ? { data: { user: { id } }, error: null } : { data: { user: null }, error: { message: 'bad' } },
      );
    },
  },
};

vi.mock('../lib/supabase', () => ({ getSupabaseAdmin: () => fakeSupabase }));
// Force the no-key path so the default transcriber uses the deterministic mock.
vi.mock('../services/goblin-hosted', () => ({ getGoblinHostedConfig: () => null }));
vi.mock('../lib/logger', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { transcribe, setTranscriber, resetTranscriber, _resetTranscribeCounts, TRANSCRIBE_DAILY_CAP, MAX_AUDIO_BYTES } =
  await import('./transcribe');

const auth = (user: string) => ({ Authorization: `Bearer user:${user}` });

function formWith(audio: File | null, extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  if (audio) fd.append('audio', audio);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return fd;
}

function audioFile(bytes: number, name = 'audio.webm'): File {
  return new File([new Uint8Array(bytes).fill(1)], name, { type: 'audio/webm' });
}

beforeEach(() => {
  _resetTranscribeCounts();
  resetTranscriber();
});

describe('POST /api/transcribe', () => {
  it('rejects an unauthenticated request → 401', async () => {
    const res = await transcribe.request('/', { method: 'POST', body: formWith(audioFile(1024)) });
    expect(res.status).toBe(401);
  });

  it('transcribes a valid audio upload → 200 with text (mock path)', async () => {
    const res = await transcribe.request('/', { method: 'POST', headers: auth('alice'), body: formWith(audioFile(2048)) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { text: string };
    expect(body.text).toBe('Dies ist eine Test-Transkription.');
  });

  it('rejects a missing audio field → 400', async () => {
    const res = await transcribe.request('/', { method: 'POST', headers: auth('alice'), body: formWith(null) });
    expect(res.status).toBe(400);
  });

  it('rejects an empty recording → 400', async () => {
    const res = await transcribe.request('/', { method: 'POST', headers: auth('alice'), body: formWith(audioFile(0)) });
    expect(res.status).toBe(400);
  });

  it('rejects audio over the size cap → 413', async () => {
    const res = await transcribe.request('/', { method: 'POST', headers: auth('alice'), body: formWith(audioFile(MAX_AUDIO_BYTES + 1)) });
    expect(res.status).toBe(413);
  });

  it('rejects a client-reported over-long duration → 413', async () => {
    const res = await transcribe.request('/', {
      method: 'POST',
      headers: auth('alice'),
      body: formWith(audioFile(2048), { durationMs: '130000' }),
    });
    expect(res.status).toBe(413);
  });

  it('returns an honest German error when transcription fails → 502', async () => {
    setTranscriber(async () => {
      throw new Error('provider down');
    });
    const res = await transcribe.request('/', { method: 'POST', headers: auth('alice'), body: formWith(audioFile(2048)) });
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/verschriftet|nochmal|tippe/i);
  });

  it('reports honestly when no speech is detected → 422', async () => {
    setTranscriber(async () => '');
    const res = await transcribe.request('/', { method: 'POST', headers: auth('alice'), body: formWith(audioFile(2048)) });
    expect(res.status).toBe(422);
  });

  it('enforces the per-user daily cap (only successes count) → 429 on overflow', async () => {
    for (let i = 0; i < TRANSCRIBE_DAILY_CAP; i++) {
      const ok = await transcribe.request('/', { method: 'POST', headers: auth('bob'), body: formWith(audioFile(1024)) });
      expect(ok.status).toBe(200);
    }
    const over = await transcribe.request('/', { method: 'POST', headers: auth('bob'), body: formWith(audioFile(1024)) });
    expect(over.status).toBe(429);
    // A different user is unaffected by bob's cap.
    const other = await transcribe.request('/', { method: 'POST', headers: auth('carol'), body: formWith(audioFile(1024)) });
    expect(other.status).toBe(200);
  });
});
