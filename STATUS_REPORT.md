# Goblin — Status Report (Abend Tag 1)
**Datum:** 2026-04-29

---

## Was heute gebaut wurde

- Landing Page (Hero, How It Works, The Problem)
- Auth-Flow: Supabase Magic Link
- Dashboard mit Sidebar (Projektliste, Model Routing Status, Settings)
- New Project Modal (Name, Description, Color)
- Workspace: Chat / Code / Preview Tabs via AppContext
- Chat-Tab mit SSE-Streaming (delta/meta/done/error)
- Code-Tab: CodeMirror Editor, File Tree, Auto-Save 800ms debounce
- Send-to-Code: CustomEvent → AppProvider → CodeTab Banner + Tab-Switch
- GitHub OAuth Connect + Push (createRepo + pushFiles)
- Model Switcher: BYOK / Free API / Goblin Hosted mit Availability-Check
- Push-to-GitHub Button + ConnectGitHub Modal
- Startup Migrations (preview_url, last_deployed_at)

## Was heute gefixt wurde

| Bug | Severity | Fix |
|---|---|---|
| IDOR: chat-stream prüfte keine Ownership | P0 | Ownership-Check eingefügt |
| Vercel token cache nie invalidiert → 401-Loop | P0 | Cache-Clear bei 401/403 |
| `deploy_logs` Tabelle nicht vorhanden → Rate-Limit deaktiviert | P0 | Auf `projects.last_deployed_at` umgestellt |
| `content!` null crash in vercel-service | P0 | `Promise.allSettled` + null-filter |
| SSE stale closure — Tokens verloren | P1 | `streamingContentRef` + `baseMessagesRef` |
| tsconfig ignoreDeprecations "6.0" ungültig | P1 | "5.0" |
| chat-tab onMessagesChange Signatur falsch | P1 | Array statt Updater-Funktion |
| **[NEU] `/project/[id]` kein AppProvider → Workspace crasht** | P0 | `app/project/layout.tsx` erstellt |
| **[NEU] lib/api.ts wirft Error bei fehlendem NEXT_PUBLIC_API_URL** | P1 | Fallback `http://localhost:3001` |
| **[NEU] CORS: justgoblin.com fehlte in allowedOrigins** | P1 | Ergänzt |
| **[NEU] index.ts rief checkAndMigrate() auf (nur Log) statt runStartupMigrations()** | P1 | runStartupMigrations() aufgerufen |

## User Flow Status

| Schritt | Status | Blockiert durch |
|---|---|---|
| Landing Page laden | ✅ | — |
| Login (Magic Link) | ✅ | — |
| Dashboard laden | ✅ | — |
| Projekt erstellen | ✅ | apiPost() mit Auth-Token korrekt |
| Chat (erste Nachricht + User-Bubble) | ✅ | — |
| SSE Stream empfangen | ✅ | split('\n'), alle Event-Types gehandelt |
| Send to Code | ✅ | AppProvider handelt Event, setzt Tab auf "code" |
| Ochre Banner "Code ready" | ✅ | CodeTab zeigt Banner wenn pendingCode gesetzt |
| Code in CodeMirror | ✅ | CodeEditor-Komponente vorhanden |
| GitHub Push | ✅ | File paths korrekt, Token vorhanden |
| Preview Tab | ⚠️ | preview_url erfordert Migration 0016 in Supabase |

## Kritischer Pfad für morgen

**Der EINE Bug der alles blockiert (heute gefixt):**
`/project/[id]` hatte kein Layout → `useApp()` warf "must be used within AppProvider" → Workspace crashte sofort. Fix: `app/project/layout.tsx` mit AppProvider + DashboardShell.

**Nächste 3 Prioritäten:**

1. **Migration 0016 deployen** — `supabase db push` in Supabase Studio ausführen. Preview Tab funktioniert danach vollständig. SQL: `ALTER TABLE projects ADD COLUMN IF NOT EXISTS preview_url TEXT; ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_deployed_at TIMESTAMPTZ;`

2. **Default Model ändern** — `contexts/app-context.tsx:49`: DEFAULT_MODEL ist "Qwen Coder 32B" (Phase 3, `available: false`). ModelSwitcher handelt das korrekt mit "Select model →" aber verwirrend. Auf Gemini Flash (free_api) umstellen sobald GOOGLE_FREE_API_KEY in Railway gesetzt.

3. **Preview Tab implementieren** — `PreviewTab` zeigt nur Placeholder. Echter Deploy-Flow via Vercel Webhook + `preview_url` aus DB anzeigen.

## Environment Variables die in Railway/Vercel gesetzt sein müssen

### Railway (API) — ohne diese startet nicht:
```
NEXT_PUBLIC_SUPABASE_URL=       # Supabase Project URL
SUPABASE_SERVICE_ROLE_KEY=      # Service Role Key
SUPABASE_JWT_SECRET=            # JWT Secret aus Supabase Settings
ENCRYPTION_KEY=                 # 32-byte random hex für BYOK Encryption
GITHUB_CLIENT_ID=               # GitHub OAuth App
GITHUB_CLIENT_SECRET=           # GitHub OAuth App
NEXT_PUBLIC_APP_URL=            # https://justgoblin.com
```

### Vercel (Web) — ohne diese kein Login:
```
NEXT_PUBLIC_SUPABASE_URL=       # Gleich wie Railway
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Anon Key
NEXT_PUBLIC_API_URL=            # Railway URL (z.B. https://goblin-api.railway.app)
```

### Optional (für Free-API Modelle):
```
GOOGLE_FREE_API_KEY=            # Gemini 2.0 Flash
GROQ_FREE_API_KEY=              # Llama 3.3 70B
```
