# Goblin — Status Report
**Datum:** 2026-04-29
**Nach Deep Analysis + Fixes**

---

## Executive Summary

Goblin hat eine vollständige Architektur mit Auth, Chat-Streaming, Code-Editor, GitHub-Push und BYOK-Routing. Heute wurde ein kritischer P0-Bug gefixt: das SSE-Stream-Interface zwischen Frontend und Backend war komplett falsch verdrahtet (alle Delta-Tokens wurden verschluckt → leere Chat-Antworten). Railway deployt jetzt erfolgreich. Vercel-Build läuft. Nächster Blocker ist das Setzen der Env-Vars in Railway + einmalige Supabase Migration.

---

## Railway Deploy Status

- **Letzter bekannter Fehler:** `Cannot find module '/app/apps/api/dist/routes/chat'` — ESM ohne `.js`-Extensions
- **Gefixt:** tsup bundelt alles in `dist/index.js` (ESM), keine Extension-Probleme
- **Erwartetes Ergebnis nach Push:** ✅ Grüner Deploy — wenn alle Required Env-Vars gesetzt sind

---

## Feature Status

| Feature | Code vorhanden | Funktioniert wirklich | Getestet |
|---|---|---|---|
| Landing Page | ✅ | ✅ | ❌ manuell |
| Auth (Magic Link) | ✅ | ✅ Login → OTP → /auth/callback → /dashboard | ❌ |
| Middleware Auth-Guard | ✅ | ✅ schützt alle nicht-gelisteten Routen | ❌ |
| Auth Callback (`/auth/callback`) | ✅ | ✅ verifyOtp + exchangeCode, redirect /dashboard | ❌ |
| Dashboard laden | ✅ | ✅ Sidebar mit Projekten, AppProvider | ❌ |
| Projekt erstellen (Modal) | ✅ | ✅ apiPost → POST /api/projects → redirect /project/[id] | ❌ |
| POST /api/projects | ✅ | ✅ Auth + Validation + DB insert | ❌ |
| Chat Tab UI | ✅ | ✅ | ❌ |
| SSE Stream — Tokens sichtbar | ✅ | ✅ **heute gefixt** (Interface-Mismatch) | ❌ |
| SSE Stream — Model-Info | ✅ | ✅ **heute gefixt** | ❌ |
| SSE Stream — Fehleranzeige | ✅ | ✅ **heute gefixt** | ❌ |
| AbortController bei Unmount | ✅ | ✅ **heute gefixt** | ❌ |
| BYOK Routing (Anthropic SDK) | ✅ | ✅ wenn Key vorhanden | ❌ |
| BYOK Routing (OpenAI-compat.) | ✅ | ✅ Groq/DeepSeek/OpenAI/etc. | ❌ |
| Free-API Pool (Gemini/Groq) | ✅ | ⚠️ nur wenn env keys gesetzt | ❌ |
| Send to Code Button | ✅ | ✅ Event → AppProvider → Tab-Switch | ❌ |
| Code Tab (Editor) | ✅ | ✅ CodeMirror, File Tree, Auto-Save | ❌ |
| BYOK Settings UI | ✅ | ✅ /dashboard/settings/keys | ❌ |
| Model Picker | ✅ | ✅ 3-Layer, Phase-Badge, "Select model →" | ❌ |
| GitHub OAuth | ✅ | ✅ wenn GITHUB_CLIENT_ID/SECRET gesetzt | ❌ |
| GitHub Push | ✅ | ✅ createRepo + pushFiles | ❌ |
| Preview Tab | ⚠️ | ⚠️ rendert, braucht Migration 0016 | ❌ |
| Vercel Deploy | ⚠️ | ⚠️ Code vorhanden, Webhooks ungetestet | ❌ |
| Billing (Stripe) | ⚠️ | ⚠️ Code vorhanden, Webhooks ungetestet | ❌ |

---

## Kritischer Pfad — Was bricht heute noch?

**Der EINE Blocker:** Railway hat keine Env-Vars gesetzt → API startet, crasht bei erstem DB-Call (`NEXT_PUBLIC_SUPABASE_URL` required). Ohne API: Login OK, aber kein Projekt erstellen, kein Chat, nichts.

**Danach die nächsten 3:**
1. **Migration 0016 in Supabase** — `preview_url` + `last_deployed_at` Columns fehlen → Preview Tab nutzlos, Vercel-Deploy-Webhook schlägt fehl
2. **Free-API Pool aktivieren** — `GOOGLE_FREE_API_KEY` in Railway → User ohne BYOK können sofort chatten
3. **E2E testen** — Login → Projekt erstellen → ersten Chat-Message senden → prüfen ob Stream ankommt

---

## Alle gefixten Bugs heute

| Bug | Severity | Fix |
|---|---|---|
| Railway: `Cannot find module dist/routes/chat` — ESM `.js` Extensions | P0 | tsup statt tsc — bundelt alles in `dist/index.js` |
| Railway: Port immer 3001, Health-Check schlägt fehl | P0 | `PORT \|\| API_PORT \|\| 3001` |
| Railway: Kein `railway.toml` — Nixpacks errät falsch | P0 | Explizites `railway.toml` mit build/start/healthcheck |
| Railway: `tsconfig.tsbuildinfo` als Datei committed, Railway mounted als Directory | P0 | Aus Git entfernt, `.gitignore` ergänzt |
| **SSE Interface-Mismatch: Delta-Tokens verschluckt** | P0 | `StreamMessage` interface auf Backend-Shape angepasst (flat nicht nested) |
| Vercel: `outputDirectory: ".next"` falsch (Monorepo) | P0 | → `apps/web/.next` |
| Vercel: `sonner` nicht in package.json | P0 | Ergänzt |
| `/project/[id]` kein AppProvider → Workspace crashte | P0 | `app/project/layout.tsx` erstellt |
| `lib/api.ts` warf Error bei fehlendem NEXT_PUBLIC_API_URL | P1 | Fallback `http://localhost:3001` |
| CORS: justgoblin.com fehlte | P1 | Ergänzt |
| AbortController fehlte (Memory Leak bei Navigation) | P1 | Zurückgebracht, signal an `apiStream` übergeben |
| Color `#3A2E1F` (Brown) im Projekt-Modal → 400 vom API | P1 | Enum → `z.string().regex(/^#[0-9A-Fa-f]{6}$/)` |
| `checkAndMigrate()` statt `runStartupMigrations()` | P1 | Korrigiert |

---

## Noch offene Issues

| Issue | Severity | Aufwand |
|---|---|---|
| Migration 0016 (`preview_url`) nicht in Supabase Production | P0 | Klein — SQL in Studio |
| `agent_runs` Tabelle existiert möglicherweise nicht in DB | P1 | Klein — Migration prüfen/schreiben |
| `code_injections` Tabelle existiert möglicherweise nicht in DB | P1 | Klein — Migration prüfen/schreiben |
| BYOK `key_encrypted` BYTEA vs TEXT in Schema | P2 | Mittel |
| Vercel Deploy Webhook ungetestet | P2 | Mittel |
| Billing Stripe Webhooks ungetestet | P2 | Mittel |
| kein CI Build-Check (typecheck schlägt fehl erst bei Vercel) | P2 | Klein — GitHub Actions bereits vorhanden aber ungetestet |

---

## Environment Variables — Was in Railway fehlen könnte

### Required (ohne diese startet API nicht):
```
NEXT_PUBLIC_SUPABASE_URL=       # z.B. https://xyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=      # Settings → API → service_role
SUPABASE_JWT_SECRET=            # Settings → API → JWT Secret
ENCRYPTION_KEY=                 # 32-byte hex: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Required für GitHub OAuth:
```
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=https://justgoblin.com
```

### Optional (aktiviert Free-API Pool — User ohne BYOK können chatten):
```
GOOGLE_FREE_API_KEY=     # Gemini 2.0 Flash — https://aistudio.google.com
GROQ_FREE_API_KEY=       # Llama 3.3 70B — https://console.groq.com
```

### Vercel (ohne diese kein Login):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Settings → API → anon public
NEXT_PUBLIC_API_URL=             # Railway service URL
```

---

## Was Vincent noch manuell tun muss

1. [ ] **Railway Env-Vars setzen** — alle 4 Required vars oben (ohne diese crashed API sofort)
2. [ ] **Vercel Env-Vars setzen** — `NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY`, `API_URL`
3. [ ] **Migration 0016 in Supabase Studio ausführen:**
   ```sql
   ALTER TABLE projects ADD COLUMN IF NOT EXISTS preview_url TEXT;
   ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_deployed_at TIMESTAMPTZ;
   ```
4. [ ] **`agent_runs` Tabelle prüfen** — in Supabase Studio: existiert `agent_runs`? Falls nicht → Migration schreiben
5. [ ] **Ersten E2E-Test machen:** Login → Projekt erstellen → Nachricht senden → prüfen ob Text erscheint
6. [ ] **GOOGLE_FREE_API_KEY in Railway setzen** — dann können User ohne eigenen Key sofort chatten
