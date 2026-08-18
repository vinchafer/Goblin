import { createBrowserClient } from '@supabase/ssr'
import { resolveApiOrigin, describeOriginProblem } from '@/lib/env/origin'

// `createBrowserClient` throws when either argument is falsy. It used to be
// called here at module scope, which meant a single missing Supabase variable
// took down every module that imports this file — including, on the server,
// every page that renders one of them. It is lazy now: the throw, if it still
// happens, belongs to the caller that actually needed a session, not to the
// import graph.
let cachedSupabase: ReturnType<typeof createBrowserClient> | null = null

function getSupabase() {
  if (!cachedSupabase) {
    cachedSupabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return cachedSupabase
}

function getApiUrl(): string {
  // Explicit setting always wins. Set NEXT_PUBLIC_API_URL=http://localhost:3001 in .env.local
  // to route dev through the LOCAL guarded API so the B3 dev-safety shield intercepts writes
  // (see docs/DEV_SAFETY.md). Leave it on the Railway URL to hit prod directly.
  //
  // One normaliser AND one default, shared with next.config.ts, so the rewrite
  // destination, the CSP connect-src and this fetch base can never disagree
  // about the API origin — that disagreement is what made the 2026-07-30 outage
  // read as two unrelated faults.
  const result = resolveApiOrigin()
  if (!result.ok) {
    console.error(`[env] ${describeOriginProblem('NEXT_PUBLIC_API_URL', result.problem!)}`)
  }
  return result.origin
}

export const API_URL = getApiUrl()

export async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = getSupabase()
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) {
    const { data: refreshed } = await supabase.auth.refreshSession()
    if (refreshed.session) {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshed.session.access_token}`
      }
    }
    return { 'Content-Type': 'application/json' }
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  }
}

// P1.10: bounded retry-on-429 for a plain fetch. The dashboard fires several
// requests on mount (projects + me + usage + connector status …); on a burst the
// API's generalRateLimit (60/min) can 429 one of them, which surfaced as
// "Projekte konnten nicht geladen werden". Retry the transient 429 with backoff
// + jitter (honoring Retry-After) before giving up. Same philosophy as the P1.7
// badge-base loader.
export async function fetchWithRetryOn429(
  input: string,
  init?: RequestInit,
  { retries = 3, baseDelayMs = 400 }: { retries?: number; baseDelayMs?: number } = {},
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(input, init);
    if (res.status !== 429 || attempt >= retries) return res;
    const retryAfter = Number(res.headers.get('Retry-After'));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : baseDelayMs * 2 ** attempt + Math.random() * 200;
    await new Promise((r) => setTimeout(r, wait));
  }
}

// WS-C: friendlier German messages for the statuses users actually hit, instead
// of a raw "API error 429". Server-provided messages still win.
//
// ════════════════════════════════════════════════════════════════════════════════
// FOUNDER-WALK-7 · U7 (D-F1) — THE ORDER OF THESE LINES IS THE BUG.
//
// The founder tapped "Live stellen" four times and read, each time:
//     "Server kurz nicht erreichbar – bitte gleich nochmal versuchen."
// The server had not said that. The server had said something specific, in German,
// about his project — e.g. "In diesem Projekt liegen noch keine Dateien, die
// veröffentlicht werden könnten." (ops-publish.ts). It never reached him, because
// the `status >= 500` line stood ABOVE the line that reads `serverMessage`, and
// `POST /api/ops/apps/publish` maps almost every failure to 502 or 503
// (ops.ts — empty_artifact, not_verified, upload_failed, route_failed → 502;
// d1_unavailable, form_unwirable, review_unqueued → 503).
//
// So the client replaced a true, actionable answer with an invented CAUSE ("the
// server is briefly unreachable") and an invented TIMELINE ("try again shortly").
// Both were unverified, and the timeline was actively harmful: it told him to
// repeat an action that could not succeed by repetition. That is what four
// identical attempts look like from the inside.
//
// The rule now: the server's own sentence wins whenever there is one, at ANY
// status. A generated line is only ever the fallback for a response that carried
// no message — and it states the fact (a status) rather than diagnosing it.
// ════════════════════════════════════════════════════════════════════════════════
function friendlyError(status: number, serverMessage?: string): string {
  // Framework placeholders (`res.statusText` when the body had no message) are not
  // the server saying anything — they are the absence of a message with a name.
  const raw = typeof serverMessage === 'string' ? serverMessage.trim() : ''
  const PLACEHOLDERS = new Set([
    'Too Many Requests', 'Internal Server Error', 'Bad Gateway',
    'Service Unavailable', 'Gateway Timeout', 'Not Found', 'Forbidden', 'Unauthorized',
  ])
  if (raw && !PLACEHOLDERS.has(raw)) return raw

  // No message came back. Say what is KNOWN — the status — and nothing else. A 429
  // is the one case where the status alone is a complete, true statement about what
  // happened, so it keeps its plain-language rendering.
  if (status === 429) return 'Zu viele Anfragen – bitte einen Moment warten und neu laden.'
  if (status === 401) return 'Sitzung abgelaufen – bitte neu anmelden.'
  // 403 used to share the 401 line. It does not share its meaning: a 403 is "not
  // allowed", which may have nothing to do with the session — and telling someone to
  // sign in again over a permission they do not have is a diagnosis, not a fact.
  if (status === 403) return 'Für diese Aktion fehlt die Berechtigung.'
  if (status >= 500) return `Die Anfrage ist fehlgeschlagen (HTTP ${status}). Der Server hat keine Begründung mitgeschickt.`
  return `API-Fehler ${status}`
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}${path}`, { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(friendlyError(res.status, err.message))
  }
  return res.json()
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(friendlyError(res.status, err.message))
  }
  return res.json()
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(friendlyError(res.status, err.message))
  }
  return res.json()
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(friendlyError(res.status, err.message))
  }
  return res.json()
}

export async function apiDelete(path: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}${path}`, { method: 'DELETE', headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(friendlyError(res.status, err.message))
  }
}

// I1 (WAVE-I insight): fire-and-forget behaviour event. Emits a whitelisted,
// metadata-only UI signal (trial_card_shown/clicked, help_opened,
// feedback_submitted) to POST /api/events. NEVER awaited on a UX path and NEVER
// throws — a failed emit must not break or slow anything the user is doing.
export function emitEvent(type: string, meta?: Record<string, string | number | boolean | null>): void {
  void (async () => {
    try {
      const headers = await getAuthHeaders()
      await fetch(`${API_URL}/api/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ type, meta }),
        keepalive: true,
      })
    } catch {
      /* silent-fail — measurement only */
    }
  })()
}

export async function apiStream(
  path: string,
  body: unknown,
  onChunk: (data: unknown) => void,
  signal?: AbortSignal
): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    // WAVE-H · H4: carry the machine code + Retry-After through so the caller can render the
    // honest "auf Anschlag" copy and auto-retry, instead of a generic server error.
    const e = new Error(err.message || err.error || `Stream error ${res.status}`) as StreamError
    e.code = err.error
    e.status = res.status
    e.reason = err.reason
    if (typeof err.retryAfterSeconds === 'number') e.retryAfterSeconds = err.retryAfterSeconds
    throw e
  }
  await readSSE(res, onChunk)
}

/** An apiStream/apiStreamGet failure carrying the server's machine code + Retry-After. */
export interface StreamError extends Error {
  code?: string
  reason?: string
  status?: number
  retryAfterSeconds?: number
}

/**
 * F-40: GET-based SSE reader for re-attaching to an in-flight run
 * (GET …/runs/:runId/events?since=N). Same wire format as apiStream, but no body — the
 * server replays the run's events then live-tails. A 404 (run not found / not ours) throws
 * so the caller can fall back to whatever it already renders.
 */
export async function apiStreamGet(
  path: string,
  onChunk: (data: unknown) => void,
  signal?: AbortSignal
): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}${path}`, { method: 'GET', headers, signal })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || err.error || `Stream error ${res.status}`)
  }
  await readSSE(res, onChunk)
}

/** Read an SSE response body, dispatching each `data:` line's JSON to onChunk. */
async function readSSE(res: Response, onChunk: (data: unknown) => void): Promise<void> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('data: ')) {
        try {
          onChunk(JSON.parse(trimmed.slice(6)))
        } catch { /* skip malformed */ }
      }
    }
  }
}