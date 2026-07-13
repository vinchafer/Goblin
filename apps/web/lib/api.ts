import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function getApiUrl(): string {
  // Explicit setting always wins. Set NEXT_PUBLIC_API_URL=http://localhost:3001 in .env.local
  // to route dev through the LOCAL guarded API so the B3 dev-safety shield intercepts writes
  // (see docs/DEV_SAFETY.md). Leave it on the Railway URL to hit prod directly.
  const url = process.env.NEXT_PUBLIC_API_URL
  if (url) return url.replace(/\/$/, '')
  // No explicit URL: in dev default to the local guarded API; in prod fall back to Railway.
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3001'
  }
  console.error('NEXT_PUBLIC_API_URL is not set in production!')
  return 'https://goblinapi-production.up.railway.app'
}

export const API_URL = getApiUrl()

export async function getAuthHeaders(): Promise<HeadersInit> {
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
function friendlyError(status: number, serverMessage?: string): string {
  // 429 / 5xx rarely carry a useful body — always use the friendly line.
  if (status === 429) return 'Zu viele Anfragen – bitte einen Moment warten und neu laden.'
  if (status >= 500) return 'Server kurz nicht erreichbar – bitte gleich nochmal versuchen.'
  if (serverMessage && serverMessage !== 'Too Many Requests') return serverMessage
  if (status === 401 || status === 403) return 'Sitzung abgelaufen – bitte neu anmelden.'
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
    throw new Error(err.message || err.error || `Stream error ${res.status}`)
  }
  await readSSE(res, onChunk)
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