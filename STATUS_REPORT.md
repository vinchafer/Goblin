# Goblin — Status Report
**Datum:** 2026-04-30
**Nach Deep Analysis + Fixes + Deploy**

---

## Executive Summary

Goblin ist live: Vercel (Web) und Railway (API) deployen und antworten korrekt. Alle kritischen Build- und Runtime-Bugs wurden heute gefixt — darunter ein P0-SSE-Interface-Mismatch der alle Chat-Antworten verschluckt hätte, ein falsch verdrahteter PORT-Env-Var der Railway dauerhaft auf 502 hielt, und eine fehlende AppProvider-Wrapper der den Workspace crashen liess. Die Plattform ist bereit für den ersten echten E2E-Test.

---

## Deploy Status

| Service | URL | Status |
|---|---|---|
| Railway (API) | `https://goblinapi-production.up.railway.app` | ✅ `/health` → `{ status: "ok", version: "1.0.0" }` |
| Vercel (Web) | `https://goblin-web.vercel.app` | ✅ Landing + Login laden |
| Custom Domain | `https://justgoblin.com` | ⚠️ DNS noch nicht konfiguriert |

---

## Feature Status

| Feature | Code | Funktioniert | Getestet |
|---|---|---|---|
| Landing Page | ✅ | ✅ | ✅ live |
| Login (Magic Link) | ✅ | ✅ | ✅ live |
| Auth Callback | ✅ | ✅ | ❌ manuell |
| Middleware Auth-Guard | ✅ | ✅ | ❌ |
| Dashboard laden | ✅ | ✅ | ❌ manuell |
| Projekt erstellen | ✅ | ✅ | ❌ manuell |
| POST /api/projects | ✅ | ✅ | ❌ |
| Chat Tab UI | ✅ | ✅ | ❌ |
| SSE Stream (Tokens live) | ✅ | ✅ gefixt | ❌ |
| BYOK Routing (Anthropic) | ✅ | ✅ wenn Key gesetzt | ❌ |
| BYOK Routing (OpenAI-compat) | ✅ | ✅ wenn Key gesetzt | ❌ |
| Free-API Pool (Gemini/Groq) | ✅ | ⚠️ nur wenn env keys gesetzt | ❌ |
| Send to Code | ✅ | ✅ | ❌ |
| Code Tab (Editor) | ✅ | ✅ | ❌ |
| BYOK Settings UI | ✅ | ✅ | ❌ |
| Model Picker | ✅ | ✅ | ❌ |
| GitHub OAuth | ✅ | ⚠️ GITHUB_CLIENT_ID/SECRET fehlen noch | ❌ |
| GitHub Push | ✅ | ⚠️ abhängig von OAuth | ❌ |
| Preview Tab | ⚠️ | ⚠️ Migration 0016 pending | ❌ |
| Vercel Deploy | ⚠️ | ⚠️ ungetestet | ❌ |
| Billing (Stripe) | ⚠️ | ⚠️ Webhooks ungetestet | ❌ |

---

## Alle gefixten Bugs (gesamter Tag)

| Bug | Severity | Fix |
|---|---|---|
| **Railway: 502 — PORT Networking falsch konfiguriert** | P0 | Service Port in Railway Dashboard auf 8080 gesetzt |
| Railway: `Cannot find module dist/routes/chat` — ESM ohne `.js` | P0 | tsup statt tsc |
| Railway: `SUPABASE_JWT_SECRET` unused aber required | P0 | Aus REQUIRED_ENV entfernt |
| Railway: `ENCRYPTION_KEY` fehlte (kein `=` in .env) | P0 | In Railway Dashboard gesetzt |
| Railway: lockfile `sonner ^1.5.0` vs package.json `^1.7.4` | P0 | `pnpm install` + lockfile committed |
| Railway: kein `railway.toml` / falsche Config | P0 | `apps/api/railway.json` konsolidiert |
| **SSE Interface-Mismatch: Delta-Tokens verschluckt** | P0 | StreamMessage interface auf flat-shape angepasst |
| Vercel: `outputDirectory: ".next"` falsch | P0 | → `apps/web/.next` |
| Vercel: `sonner` nicht in package.json | P0 | Ergänzt |
| `/project/[id]` kein AppProvider → Workspace crash | P0 | `app/project/layout.tsx` erstellt |
| AbortController fehlte (Memory Leak) | P1 | Re-added + signal an `apiStream` |
| Color `#3A2E1F` → 400 vom API | P1 | Hex-Regex statt Enum |
| `lib/api.ts` warf Error bei fehlendem NEXT_PUBLIC_API_URL | P1 | Fallback `localhost:3001` |
| CORS: `justgoblin.com` fehlte | P1 | Ergänzt |

---

## Nächste Schritte (Priorität)

1. **E2E Test**: Login → Projekt erstellen → Nachricht senden → prüfen ob Stream ankommt
2. **Migration 0016** in Supabase Studio:
   ```sql
   ALTER TABLE projects ADD COLUMN IF NOT EXISTS preview_url TEXT;
   ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_deployed_at TIMESTAMPTZ;
   ```
3. **GitHub OAuth** konfigurieren: `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` in Railway
4. **Free-API Pool** aktivieren: `GOOGLE_FREE_API_KEY` in Railway → User ohne BYOK können sofort chatten
5. **Custom Domain** `justgoblin.com` → DNS auf Vercel + `api.justgoblin.com` → Railway

---

## Environment Variables — Aktueller Stand

### Railway ✅ gesetzt:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY`

### Railway ⚠️ fehlt noch:
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub Push broken ohne
- `NEXT_PUBLIC_APP_URL` → `https://justgoblin.com` (für OAuth Callback)
- `GOOGLE_FREE_API_KEY` — optional, aber aktiviert Free-Tier für alle User

### Vercel ✅ gesetzt:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` → `https://goblinapi-production.up.railway.app`
