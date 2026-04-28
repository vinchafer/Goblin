# Goblin — Status Report
**Datum:** 2026-04-28
**Analysiert von:** Claude Sonnet 4.6

---

## 1. Projekt-Überblick

Goblin ist ein KI-gestützter Code-Editor / App-Builder als SaaS. Nutzer beschreiben Projekte im Chat, die KI generiert Code, der per GitHub oder Vercel deployed werden kann.

**Monorepo-Struktur:**
```
goblin-monorepo (pnpm workspaces)
├── apps/web          Next.js 16 / React 19 — Frontend (Vercel)
├── apps/api          Hono on Node.js — Backend API (Railway)
└── packages/shared   Shared DB-Types + Schemas
```

---

## 2. Infrastruktur & Deployment

| Komponente | Technologie | Ziel-URL |
|---|---|---|
| Frontend | Next.js 16 + React 19 | justgoblin.com (Vercel) |
| Backend API | Hono 4.6 + Node.js | api.justgoblin.com (Railway) |
| Datenbank | Supabase (PostgreSQL + Auth + RLS) | — |
| Datei-Storage | S3-kompatibel (Hetzner) + In-Memory-Fallback | — |
| Billing | Stripe | — |

**Vercel-Konfiguration:** `vercel.json` rewritet `/api/*` → `https://api.justgoblin.com/api/*`. Railway startet via `pnpm --filter @goblin/api start`.

**CI/CD:** Keine `.github/workflows/` vorhanden. Kein automatisiertes Testing oder Deployment-Pipeline im Repo.

---

## 3. Datenbank-Schema (Supabase)

16 Migrationen bisher. Alle Tabellen mit RLS abgesichert.

| Tabelle | Zweck |
|---|---|
| `users` | Nutzerprofile, Plan, Billing-State, Request-Counter |
| `projects` | Projekte (Name, Color, GitHub-Repo, `preview_url` ⚠️ neu) |
| `chat_messages` | Nachrichtenhistorie pro Projekt |
| `agent_runs` | Token-Tracking pro AI-Aufruf |
| `byok_keys` | Verschlüsselte API-Keys der Nutzer |
| `oauth_states` | CSRF-Tokens für GitHub OAuth |
| `push_subscriptions` | Web-Push-Endpoints |
| `models` | Verfügbare AI-Modelle (admin-konfigurierbar) |
| `code_injections` | Code-Snippets per Dateiname injizierbar |

**Migration 0016** (`preview_url`, `last_deployed_at`) ist lokal vorhanden, aber noch **nicht committed**.

---

## 4. API-Routen (Hono)

| Route | Datei | Funktion |
|---|---|---|
| `GET /health` | `health.ts` | Health-Check |
| `POST /api/chat/stream` | `chat.ts` | SSE-Stream, BYOK-gesteuert |
| `GET /api/chat/:projectId/history` | `chat.ts` | Chat-Historie |
| `* /api/projects` | `projects.ts` | CRUD Projekte + Datei-Download/Upload |
| `* /api/byok-keys` | `byok-keys.ts` | BYOK-Key-Verwaltung |
| `* /api/github` | `github.ts` | OAuth-Flow + Repo-Push |
| `* /api/billing` | `billing.ts` | Stripe Checkout, Portal, Webhook |
| `* /api/notifications` | `notifications.ts` | Web-Push Subscribe/Send |
| `* /api/models` | `models.ts` | Modell-Liste |
| `* /api/admin` | `admin.ts` | Admin-Actions (via `x-admin-key`) |
| `POST /api/deploy/vercel` | `deploy.ts` ⚠️ | SSE-Deploy zu Vercel |
| `GET /api/deploy/vercel/:id/status` | `deploy.ts` ⚠️ | Deploy-Status |

⚠️ = neu, noch nicht committed

---

## 5. KI & Model-Routing

**Ausschließlich BYOK** (kein Goblin-eigenes Budget). Nutzer hinterlegen ihren eigenen API-Key.

**Unterstützte Provider:**

| Provider | Typ | Default-Modell |
|---|---|---|
| Anthropic | Native SDK | claude-sonnet-4-6 |
| OpenAI | OpenAI-kompatibel | gpt-4o |
| Groq | OpenAI-kompatibel | llama-3.3-70b-versatile |
| DeepSeek | OpenAI-kompatibel | deepseek-chat |
| Mistral | OpenAI-kompatibel | mistral-large-latest |
| xAI (Grok) | OpenAI-kompatibel | grok-2-1212 |
| Together | OpenAI-kompatibel | Llama-3-70b |
| Google | OpenAI-kompatibel | gemini-2.0-flash |
| Vercel (BYOK) | Deploy-Token | — |

**Provider-Priorität bei Auto-Select:** Anthropic → OpenAI → DeepSeek → Groq → Mistral → Google → xAI → Together

---

## 6. Billing / Pläne

| Plan | Preis | Requests/Monat |
|---|---|---|
| seed | €9 | 200 |
| craft | €19 | 800 |
| forge | €39 | 3.000 |

Usage-Limit-Middleware (`usage-limit.ts`) prüft und inkrementiert `monthly_requests_used` synchron vor jedem Chat-Stream. Stripe-Webhook resettet Counter bei `invoice.paid`.

---

## 7. Feature-Status

### Vollständig implementiert ✅
- Auth (Supabase Magic Link / OAuth)
- Projekt-CRUD + Datei-Storage (Hetzner S3 + In-Memory-Fallback)
- Chat-Stream (SSE, BYOK, Multi-Provider)
- Code-Editor (CodeMirror 6, Read/Write Dateien)
- GitHub-Integration (OAuth + Repo-Push)
- Billing (Stripe Checkout, Portal, Webhooks)
- BYOK-Key-Verwaltung (AES-verschlüsselt)
- Web-Push-Notifications (VAPID)
- Admin-API
- PWA (manifest.json, Service Worker)
- Landing Page mit Pricing
- Model-Switcher im Dashboard

### Neu / Noch nicht committed ⚠️
- **Vercel Deploy-Feature** (`deploy.ts`, `vercel-service.ts`) — SSE-Deploy-Flow vollständig, schreibt `preview_url` in DB
- **Preview-Tab** (`components/preview/preview-tab.tsx`) — iframe mit Viewport-Switcher (375/768/1440px)
- **DB-Migration 0016** — `preview_url` + `last_deployed_at` auf `projects`

---

## 8. Offene Baustellen / Bugs

### Kritisch
- **PreviewTab nicht verdrahtet:** `project-workspace.tsx` kennt nur `"code"` und `"chat"` als Tabs — kein `"preview"`. `project/[id]/page.tsx` übergibt `preview_url` nicht an `ProjectWorkspace`. Die neuen Komponenten existieren, sind aber nicht eingebunden.
- **Migration 0016 nicht deployed:** `preview_url`-Spalte existiert in Production noch nicht, bis die Migration ausgerollt wird.

### Mittel
- **Vercel-Token-Cache:** `_vercelTokenCache` ist eine prozess-lokale `Map` — geht bei API-Restart verloren (kein Problem, aber kein Re-Fetch bis nächster Login-Request; bereits handled durch lazy refetch).
- **100-Datei-Limit** in `vercel-service.ts` (`files.slice(0, 100)`) — größere Projekte werden stillschweigend gekürzt.
- **Rate-Limit fehlt auf `/api/deploy`** — kein `usageLimitMiddleware` auf Deploy-Route; könnte missbraucht werden.
- **File-Path-Bug in `github.ts`:** `fullPath.replace(\`${result.data.projectId}/\`, '')` — entfernt nur erste Occurrence und nur wenn im Pfad vorhanden; `listFiles` gibt relative Pfade zurück, nicht mit projektId-Präfix.

### Klein
- Kein CI/CD-Pipeline im Repo.
- Kein Test-Suite (keine Unit-, Integration- oder E2E-Tests).
- `apps/web/tsconfig.json` modifiziert, aber Änderung unklar (nicht committed).

---

## 9. Offene Git-Changes (nicht committed)

```
M  apps/api/src/index.ts              — deploy-Route registriert
M  apps/web/tsconfig.json             — unbekannte Änderung
M  packages/shared/src/database.types.ts — preview_url-Typen ergänzt
?? apps/api/src/routes/deploy.ts      — NEU
?? apps/api/src/services/vercel-service.ts — NEU
?? apps/web/components/preview/      — NEU (PreviewTab-Komponente)
?? supabase/migrations/0016_preview_url.sql — NEU
```

**Empfehlung:** Vor dem nächsten Session-Start alles commiten und Migration 0016 auf Supabase deployen.

---

## 10. Empfohlene nächste Schritte (Prio-Reihenfolge)

1. **PreviewTab einbinden** — `ProjectWorkspace` um `"preview"`-Tab erweitern, `preview_url` vom Server in `ProjectPage` fetchen und durchreichen.
2. **Migration 0016 deployen** (`supabase db push` oder SQL in Supabase Studio ausführen).
3. **Alles committen** — Deploy-Feature + Preview-Tab als einen atomaren Commit.
4. **Rate-Limit auf Deploy-Route** — `usageLimitMiddleware` oder separates Deploy-Limit ergänzen.
5. **100-Datei-Limit erhöhen / paginieren** — Vercel API unterstützt mehr via mehrere Upload-Calls.
6. **CI/CD** — GitHub Actions: typecheck + lint on PR, ggf. smoke-test nach Deploy.
