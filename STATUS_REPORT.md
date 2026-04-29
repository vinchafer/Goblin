# Goblin — Status Report (Abend Tag 1)
**Datum:** 2026-04-29 | **Branch:** master | **Letzter Commit:** 2f6d829

---

## Was heute gebaut wurde

- Landing Page (Hero, How It Works, The Problem)
- Auth-Flow: Supabase Magic Link
- Dashboard mit Sidebar (Projektliste, Model Routing Status, Settings)
- New Project Modal (Name, Description, Color Picker)
- App-Context: Tab-State (Chat/Code/Preview), Model-State, Injection-Queue
- Chat-Tab: SSE-Streaming mit Ref-Pattern (kein stale closure), AbortController, Suggestion Pills
- Code-Tab: CodeMirror Editor, File Tree, Auto-Save 800ms debounce, Injection Banner
- Send-to-Code: `goblin:sendToCode` CustomEvent → AppProvider → Tab-Switch + pendingCode Banner
- GitHub OAuth Connect + Push (createRepo + pushFiles via GitHub Trees API)
- Model Switcher: BYOK / Free API / Goblin Hosted Tiers, Availability-Check, Key-Links
- Push-to-GitHub Button + ConnectGitHub Modal + PushToGitHub Modal
- Startup Migrations (preview_url, last_deployed_at — idempotent, läuft beim API-Start)
- CORS für Vercel + justgoblin.com + Preview Deployments

---

## User Flow Status

| Schritt | Status | Notiz |
|---|---|---|
| Landing Page laden | ✅ | — |
| Login (Magic Link) | ✅ | Supabase SSR korrekt |
| Dashboard laden | ✅ | Sidebar zeigt Projekte, kein Duplikat |
| Projekt erstellen | ✅ | Modal → `apiPost()` mit Token → redirect `/project/[id]` |
| Chat: User-Bubble sofort | ✅ | Optimistic update vor fetch |
| SSE Stream (Tokens live) | ✅ | split('\n'), alle Event-Types (delta/meta/done/error) |
| Send to Code → Tab wechselt | ✅ | AppProvider handelt Event, setzt activeTab = "code" |
| Ochre Banner "Code ready" | ✅ | CodeTab zeigt Banner + Filename-Chip |
| Code in CodeMirror | ✅ | CodeEditor mit Syntax Highlighting |
| Push to GitHub | ✅ | OAuth-Flow → createRepo → pushFiles mit korrekten Pfaden |
| Preview Tab | ⚠️ | Rendert, aber `preview_url` erfordert Migration 0016 in Supabase |

---

## Alle gefixten Bugs (gesamter Tag)

| Bug | Severity | Status |
|---|---|---|
| IDOR: chat-stream prüfte keine Project-Ownership | P0 | ✅ gefixt |
| Vercel token cache nie invalidiert → 401-Loop | P0 | ✅ gefixt |
| `deploy_logs` nicht vorhanden → Rate-Limit silent disabled | P0 | ✅ gefixt |
| `content!` null crash in vercel-service | P0 | ✅ gefixt |
| **`/project/[id]` kein AppProvider → Workspace crashte sofort** | P0 | ✅ gefixt (heute Abend) |
| SSE stale closure — Tokens verloren bei schnellen Events | P1 | ✅ gefixt |
| tsconfig ignoreDeprecations "6.0" ungültig | P1 | ✅ gefixt |
| chat-tab onMessagesChange Signatur falsch | P1 | ✅ gefixt |
| **lib/api.ts warf Error bei fehlendem NEXT_PUBLIC_API_URL** | P1 | ✅ gefixt (heute Abend) |
| **CORS: justgoblin.com fehlte** | P1 | ✅ gefixt (heute Abend) |
| **index.ts: checkAndMigrate() (nur Log) statt runStartupMigrations()** | P1 | ✅ gefixt (heute Abend) |
| byok-keys.ts: ZodError crashte zu 500 | P1 | ✅ gefixt |
| byok-keys.ts: 200 statt 404 bei fehlendem Key | P1 | ✅ gefixt |
| GitHub file paths: falscher replace-Ansatz | P1 | ✅ war bereits korrekt im Code |
| Hardcoded "Deploying..." in Sidebar | P1 | ✅ war bereits "No active builds" im Code |

---

## Noch offen

| Issue | Severity | Aufwand |
|---|---|---|
| **Migration 0016 auf Supabase Production** | P0 | 2 Min — SQL in Studio ausführen |
| DEFAULT_MODEL "Qwen Coder 32B" (Phase 3, unavailable) | P2 | Klein — nach GOOGLE_FREE_API_KEY setzen |
| Preview Tab: echter Deploy-Flow | P2 | Groß — Vercel Webhook + preview_url |
| `getSession()` ohne expliziten Refresh | P2 | Klein — Auto-Refresh via createBrowserClient aktiv |
| BYOK `key_encrypted` BYTEA vs TEXT | P2 | Mittel — Migration oder Dokumentation |
| kein CI/CD (typecheck + lint on PR) | P2 | Mittel |

---

## Kritischer Pfad für morgen

**Der EINE Handgriff der Preview entsperrt:**
```sql
-- In Supabase Studio → SQL Editor ausführen:
ALTER TABLE projects ADD COLUMN IF NOT EXISTS preview_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_deployed_at TIMESTAMPTZ;
```

**Nächste 3 Features:**
1. Preview Tab — echten iFrame + Deploy-Status anzeigen
2. Billing — Stripe Webhooks testen
3. Free-API Pool aktivieren — GOOGLE_FREE_API_KEY in Railway setzen → DEFAULT_MODEL auf Gemini Flash ändern

---

## Environment Variables

### Railway (API) — ohne diese startet nicht:
```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
ENCRYPTION_KEY=               # 32-byte random hex
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=          # https://justgoblin.com
```

### Vercel (Web) — ohne diese kein Login:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=          # Railway URL
```

### Optional (für Modelle):
```
GOOGLE_FREE_API_KEY=          # Gemini 2.0 Flash (Free Tier)
GROQ_FREE_API_KEY=            # Llama 3.3 70B (Free Tier)
```
