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

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}${path}`, { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `API error ${res.status}`)
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
    throw new Error(err.message || `API error ${res.status}`)
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
    throw new Error(err.message || `API error ${res.status}`)
  }
  return res.json()
}

export async function apiDelete(path: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}${path}`, { method: 'DELETE', headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `API error ${res.status}`)
  }
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