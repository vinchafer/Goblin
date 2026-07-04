/**
 * Dictation transcription endpoint (Sprint CHAT-IO C1).
 *
 * Uniform iOS/desktop fallback for browsers without a usable Web Speech API
 * (chiefly iOS Safari): the client records via MediaRecorder and POSTs the audio
 * here; we transcribe it with a Whisper-class model over the existing DeepInfra
 * OpenAI-compatible endpoint and return the text for the user to review in the
 * composer. The result NEVER auto-sends — the client only inserts it.
 *
 * Billing: platform COGS v1 (ledger M8) — a Whisper call, not a user-allowance
 * chat turn. Abuse guard = a per-user daily cap (in-memory v1). Accounting is a
 * structured log line, mirroring the M3 project-state summarizer.
 */
import { Hono } from 'hono';
import OpenAI, { toFile } from 'openai';
import { authMiddleware } from '../middleware/auth';
import { getGoblinHostedConfig } from '../services/goblin-hosted';
import logger from '../lib/logger';

// ── Knobs (ledger M8) ─────────────────────────────────────────────────────────
// Size cap ≈ 2 min of audio at a high bitrate. MediaRecorder/opus is far smaller
// in practice; this is the abuse ceiling. We cap on bytes (not decoded duration —
// not worth an audio-decode dependency) plus an optional client-reported duration.
// The client also hard-stops recording at ~120s.
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_AUDIO_DURATION_MS = 125_000; // ~2 min + slack
// Per-user daily transcription cap (abuse guard). v1: in-memory, per instance —
// resets on deploy, not shared across replicas. Adequate as a v1 abuse ceiling;
// promote to a persisted counter if transcription volume grows. Knob = here.
export const TRANSCRIBE_DAILY_CAP = 30;

const TRANSCRIBE_MODEL = process.env.GOBLIN_TRANSCRIBE_MODEL || 'openai/whisper-large-v3-turbo';

// ── Daily counter (in-memory, per instance) ────────────────────────────────────
const dailyCounts = new Map<string, number>();
function dayKey(userId: string): string {
  return `${userId}:${new Date().toISOString().slice(0, 10)}`; // userId:YYYY-MM-DD (UTC)
}
/** Test hook — clear the in-memory daily counter between cases. */
export function _resetTranscribeCounts(): void {
  dailyCounts.clear();
}

// ── Transcriber (injectable for deterministic testing) ─────────────────────────
export type Transcriber = (audio: Uint8Array, filename: string, lang?: string) => Promise<string>;

/** Local / no-key path: deterministic stub so local E2E works without DeepInfra. */
const mockTranscriber: Transcriber = async () => 'Dies ist eine Test-Transkription.';

/** Real path over DeepInfra's OpenAI-compatible Whisper endpoint. */
const deepInfraTranscriber: Transcriber = async (audio, filename, lang) => {
  const config = getGoblinHostedConfig();
  if (!config) return mockTranscriber(audio, filename, lang); // no key locally → mock
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  const file = await toFile(Buffer.from(audio), filename);
  const res = await client.audio.transcriptions.create({
    file,
    model: TRANSCRIBE_MODEL,
    language: lang === 'en' ? 'en' : lang === 'de' ? 'de' : undefined,
  });
  return (res.text ?? '').trim();
};

let transcriber: Transcriber = deepInfraTranscriber;
export function setTranscriber(t: Transcriber): void {
  transcriber = t;
}
export function resetTranscriber(): void {
  transcriber = deepInfraTranscriber;
}

// ── Route ───────────────────────────────────────────────────────────────────
export const transcribe = new Hono<{ Variables: { userId: string } }>();
transcribe.use('*', authMiddleware);

transcribe.post('/', async (c) => {
  const userId = c.get('userId');

  // Daily abuse cap (checked before doing any work).
  const key = dayKey(userId);
  const used = dailyCounts.get(key) ?? 0;
  if (used >= TRANSCRIBE_DAILY_CAP) {
    return c.json(
      { error: 'Du hast heute schon viele Diktate genutzt — probier es morgen wieder oder tippe deinen Text.' },
      429,
    );
  }

  let body: Record<string, string | File>;
  try {
    body = await c.req.parseBody();
  } catch {
    return c.json({ error: 'Die Audiodatei konnte nicht gelesen werden.' }, 400);
  }

  const audio = body['audio'];
  const langField = typeof body['lang'] === 'string' ? body['lang'] : undefined;
  const durationField = typeof body['durationMs'] === 'string' ? Number(body['durationMs']) : NaN;

  if (!(audio instanceof File)) {
    return c.json({ error: 'Keine Audioaufnahme empfangen.' }, 400);
  }
  if (audio.size === 0) {
    return c.json({ error: 'Die Aufnahme war leer — bitte sprich etwas und versuch es nochmal.' }, 400);
  }
  if (audio.size > MAX_AUDIO_BYTES || (Number.isFinite(durationField) && durationField > MAX_AUDIO_DURATION_MS)) {
    return c.json({ error: 'Die Aufnahme ist zu lang. Bitte bleib bei rund zwei Minuten pro Diktat.' }, 413);
  }

  const bytes = new Uint8Array(await audio.arrayBuffer());
  let text: string;
  try {
    text = await transcriber(bytes, audio.name || 'audio.webm', langField);
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'transcribe_failed');
    return c.json(
      { error: 'Die Aufnahme konnte gerade nicht verschriftet werden. Bitte versuch es gleich nochmal oder tippe deinen Text.' },
      502,
    );
  }

  if (!text) {
    return c.json(
      { error: 'Ich konnte in der Aufnahme keine Sprache erkennen. Bitte sprich etwas deutlicher.' },
      422,
    );
  }

  // Count only successful transcriptions against the daily cap.
  dailyCounts.set(key, used + 1);
  // Ledger M8 accounting: platform COGS via a structured log line (mirrors M3).
  logger.info(
    { feature: 'dictation-transcribe', billing: 'platform_cogs', bytes: audio.size, model: TRANSCRIBE_MODEL },
    'transcription_billed',
  );

  return c.json({ text });
});
