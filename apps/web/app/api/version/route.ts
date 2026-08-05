import { NextResponse } from 'next/server'
import { normalizeOrigin, describeOriginProblem, type OriginProblem } from '@/lib/env/origin'

/**
 * The diagnosis endpoint. Its one hard requirement: it answers 200 even when the
 * configuration around it is broken, because it is what you reach for when the
 * rest of the app is down. On 2026-07-30 it was the first thing the founder
 * checked and it 500'd along with everything else — a malformed
 * `NEXT_PUBLIC_API_URL` made Next refuse to write the CSP header on every
 * server-rendered response, this route included. Nothing in here may throw, and
 * the whole body is assembled inside a try/catch so a future addition cannot
 * quietly take that property away again.
 */

/**
 * Present/absent only — never a value. Secrets never appear on this surface.
 *
 * Each entry reads its variable through a *static* `process.env.NAME` reference
 * on purpose. `NEXT_PUBLIC_*` values are substituted into the bundle at build
 * time, and only a literal reference gets substituted — a dynamic
 * `process.env[name]` lookup reads the (empty) runtime environment instead and
 * would report every variable as absent. A config surface that lies about the
 * config is worse than no config surface.
 */
const REQUIRED_WEB_ENV: ReadonlyArray<readonly [string, string | undefined]> = [
  ['NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY],
  ['NEXT_PUBLIC_API_URL', process.env.NEXT_PUBLIC_API_URL],
  ['NEXT_PUBLIC_APP_URL', process.env.NEXT_PUBLIC_APP_URL],
]

export async function GET() {
  try {
    const apiFallback =
      process.env.NODE_ENV === 'production'
        ? 'https://goblinapi-production.up.railway.app'
        : 'http://localhost:3001'
    const apiOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_API_URL, apiFallback)
    const appOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL, 'https://www.justgoblin.com')

    const present: string[] = []
    const absent: string[] = []
    for (const [name, raw] of REQUIRED_WEB_ENV) {
      if (raw && raw.trim() !== '') present.push(name)
      else absent.push(name)
    }

    // next.config.ts substitutes the *normalised* origin for
    // NEXT_PUBLIC_API_URL across the whole bundle, so by the time this route
    // reads it the value already looks clean — which would make this surface
    // quietly report `healthy: true` over a misconfiguration. The build carries
    // its verdict across in GOBLIN_API_URL_PROBLEM (a problem code, never a
    // value); that verdict wins here, and the local check is the fallback for
    // any context where the substitution did not run.
    const buildVerdict = process.env.GOBLIN_API_URL_PROBLEM as OriginProblem | '' | undefined

    const problems: string[] = []
    if (buildVerdict) {
      problems.push(describeOriginProblem('NEXT_PUBLIC_API_URL', buildVerdict))
    } else if (!apiOrigin.ok) {
      problems.push(describeOriginProblem('NEXT_PUBLIC_API_URL', apiOrigin.problem!))
    }
    if (!appOrigin.ok && appOrigin.problem !== 'missing') {
      problems.push(describeOriginProblem('NEXT_PUBLIC_APP_URL', appOrigin.problem!))
    }

    return NextResponse.json({
      version: process.env.npm_package_version || '0.0.0',
      gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
      // U7.6: the time this bundle was BUILT, inlined by next.config.ts at build time.
      // This used to be `new Date()` — i.e. the time of the request — under the same
      // name, so every response looked freshly deployed no matter how old the deploy
      // was. It misled a full night of diagnosis. `null` rather than a guess if the
      // build-time value is somehow absent; `serverTime` below is the request clock,
      // now named for what it actually is (and useful for spotting clock skew).
      buildTime: process.env.GOBLIN_BUILD_TIME ?? null,
      serverTime: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
      apiUrl: apiOrigin.origin,
      webReady: true,
      config: {
        // Names only. A reader of this endpoint learns *which* variable is wrong
        // and *why*, never what it is set to.
        present,
        absent,
        problems,
        healthy: absent.length === 0 && problems.length === 0,
      },
    })
  } catch (err) {
    // Degraded, but answering. A 200 carrying `webReady:false` is a usable
    // signal; a 500 here tells the founder nothing he did not already know.
    return NextResponse.json({
      version: 'unknown',
      gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
      webReady: false,
      config: {
        present: [],
        absent: [],
        problems: [
          `/api/version could not assemble its own report: ${(err as Error)?.name ?? 'Error'}`,
        ],
        healthy: false,
      },
    })
  }
}
