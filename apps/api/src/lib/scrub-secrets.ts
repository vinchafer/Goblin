// WAVE-D · D-3 — the single secret-scrubbing pass for everything that leaves the
// process into a durable or client-visible sink (logs, agent_runs rows, chat history,
// error responses). Two complementary layers, because no single one is sufficient:
//
//   1. PATTERN layer — redacts values by their recognizable shape (sk-ant-…, sk_live_…,
//      whsec_…, AIza…, gsk_…, xai-…, fw-…, re_…, gh*_…, GitHub PATs, JWTs, Bearer
//      tokens). Catches user-supplied BYOK keys that never sit in our env.
//   2. ENV-VALUE layer — redacts the EXACT plaintext of our own configured secrets
//      (DeepInfra, Brave, VAPID private key, Stripe, Supabase service-role, master
//      encryption key, …). Catches the prefix-less crown-jewels the pattern layer
//      cannot recognize by shape.
//
// The pino logger, the agent run finalizer, chat-message writes, and the client error
// helper all route through scrubSecrets() so a secret cannot surface even if some
// upstream error text or model output echoes it.

export const REDACTED = '[REDACTED]';

// Prefixed / structurally-recognizable secret shapes. Kept deliberately conservative
// on length so ordinary prose ("token", "the key is here") is not eaten.
const PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9._-]{16,}/g, // Anthropic (before the generic sk- rule)
  /sk-or-v1-[A-Za-z0-9._-]{16,}/g, // OpenRouter
  /sk-proj-[A-Za-z0-9._-]{16,}/g, // OpenAI project keys
  /sk-[A-Za-z0-9]{20,}/g, // OpenAI / DeepSeek / generic sk-
  /sk_(?:live|test)_[A-Za-z0-9]{10,}/g, // Stripe secret keys
  /rk_(?:live|test)_[A-Za-z0-9]{10,}/g, // Stripe restricted keys
  /whsec_[A-Za-z0-9]{16,}/g, // Stripe webhook signing secret
  /AIza[A-Za-z0-9_-]{20,}/g, // Google AI
  /gsk_[A-Za-z0-9]{20,}/g, // Groq
  /xai-[A-Za-z0-9]{20,}/g, // xAI
  /fw-[A-Za-z0-9]{20,}/g, // Fireworks
  /re_[A-Za-z0-9]{16,}/g, // Resend
  /github_pat_[A-Za-z0-9_]{22,}/g, // GitHub fine-grained PAT
  /gh[posru]_[A-Za-z0-9]{20,}/g, // GitHub classic PAT / OAuth / server / refresh
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, // JWT (Supabase service-role/anon)
];

// A Bearer/token header value: redact only the credential, keep the label.
const BEARER = /(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{16,}/gi;

// Env vars whose VALUE is a secret and must be redacted by exact match wherever it
// appears. Covers the prefix-less keys the pattern layer can't recognize.
const SECRET_ENV_VARS = [
  'DEEPINFRA_API_KEY',
  'BRAVE_SEARCH_API_KEY',
  'VAPID_PRIVATE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'ENCRYPTION_KEY',
  'LITELLM_MASTER_KEY',
  'RESEND_API_KEY',
  'CRON_SECRET',
  'ADMIN_API_KEY',
  'STORAGE_KEY',
  'STORAGE_SECRET',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_CLIENT_SECRET_RAILWAY',
  'INVESTOR_MODELS_TOKEN',
] as const;

// Only redact env values long enough to be a real secret — never redact "", "true",
// a short flag, etc. (would corrupt unrelated text).
const MIN_ENV_SECRET_LEN = 12;

/** Escape a literal string for safe inclusion in a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Redact any exact occurrence of a configured secret env value. Read fresh each call
 *  so tests (and late-loaded env) are honored; the list is tiny so the cost is trivial. */
function scrubEnvValues(input: string): string {
  let out = input;
  for (const name of SECRET_ENV_VARS) {
    const val = process.env[name];
    if (val && val.length >= MIN_ENV_SECRET_LEN && out.includes(val)) {
      out = out.split(val).join(REDACTED);
    }
  }
  return out;
}

/** Scrub a single string: env-value matches first, then structural patterns. */
export function scrubString(input: string): string {
  if (!input) return input;
  let out = scrubEnvValues(input);
  for (const re of PATTERNS) out = out.replace(re, REDACTED);
  out = out.replace(BEARER, (_m, label: string) => `${label} ${REDACTED}`);
  return out;
}

/**
 * Deep-scrub any value: strings are scrubbed, objects/arrays are walked and returned as
 * a scrubbed copy (originals are never mutated). Non-string primitives pass through.
 * Guards against cycles and caps depth so a pathological object can't hang a log call.
 */
export function scrubSecrets<T>(value: T, _depth = 0, _seen = new WeakSet<object>()): T {
  if (typeof value === 'string') return scrubString(value) as unknown as T;
  if (value == null || typeof value !== 'object') return value;
  if (_depth > 8) return value;
  if (_seen.has(value as object)) return value;
  _seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => scrubSecrets(v, _depth + 1, _seen)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = scrubSecrets(v, _depth + 1, _seen);
  }
  return out as unknown as T;
}

/**
 * Map an arbitrary thrown error into a safe, client-visible message: the error's own
 * text, secret-scrubbed. Upstream provider 401 bodies frequently echo the submitted
 * key — this ensures such a body can never reach the browser verbatim.
 */
export function safeErrorMessage(err: unknown, fallback = 'Unerwarteter Fehler'): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const scrubbed = scrubString(raw).trim();
  return scrubbed || fallback;
}
