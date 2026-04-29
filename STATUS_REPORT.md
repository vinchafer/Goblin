# Goblin — Status Report
**Datum:** 2026-04-29
**Nach Code Review + Fixes (Commits e1cc72e + 30b9b83)**

---

## Executive Summary

Goblin ist funktional deployed (Web auf Vercel, API auf Railway) mit vollständigem BYOK-Chat, GitHub-Integration und Vercel-Deploy-Feature. Heute wurden 8 kritische Bugs gefixt: ein IDOR-Sicherheitsloch im Chat-Stream, ein nicht-funktionierender Deploy-Rate-Limiter (referenzierte eine nicht existierende DB-Tabelle), stale-closure-Tokenverlust im SSE-Stream sowie fehlende Fehlerbehandlung in 3 API-Routen. Migration 0016 (preview_url) muss noch manuell auf Supabase deployed werden.

---

## Feature Status

| Feature | Status | Funktioniert wirklich? | Getestet? |
|---|---|---|---|
| Auth (Magic Link) | ✅ | Ja | Nein (manuell) |
| Projekt erstellen | ✅ | Ja | Nein |
| Chat Stream (BYOK) | ✅ | Ja — Stale-Closure-Bug gefixt | Nein |
| Send to Code | ✅ | Ja | Nein |
| Code Tab (Editor) | ✅ | Ja | Nein |
| GitHub OAuth | ✅ | Ja | Nein |
| GitHub Push | ✅ | Ja | Nein |
| Vercel Deploy | ⚠️ | Partial — Bugs gefixt, Migration 0016 pending | Nein |
| Preview Tab | ⚠️ | Partial — zeigt URL, Migration 0016 pending | Nein |
| BYOK Settings UI | ✅ | Ja — Error-Handling gefixt | Nein |
| Model Picker | ⚠️ | UI vorhanden, 3-Layer-Routing aktiv | Nein |
| Billing (Stripe) | ⚠️ | Code vollständig, Webhooks ungetestet | Nein |
| Push Notifications | ⚠️ | Implementiert, VAPID-Konfiguration unklar | Nein |
| Landing Page | ✅ | Ja | Nein |
| Mobile PWA | ⚠️ | manifest.json + sw.js vorhanden, ungetestet | Nein |

**Legende:** ✅ Vollständig | ⚠️ Partial/Buggy | ❌ Fehlt

---

## Vercel Deploy — Root Cause & Fix

**Was war kaputt:**
1. **Token-Cache-Invalidierung fehlte**: `_vercelTokenCache` wurde nie geleert. Wenn ein User seinen Vercel-Token widerrief und einen neuen in DB speicherte, wurde trotzdem der alte gecachte Token verwendet → 401-Fehler bei jedem Deploy-Versuch, ohne Möglichkeit der Selbstheilung ohne API-Restart.
2. **`content!` null-assertion**: `Buffer.from(content!)` crashed wenn eine Datei in S3 nicht lesbar war (gelöscht, race condition). War unkontrollierter Crash → Deploy-Fehler ohne klare Meldung.
3. **Rate-Limit referenzierte nicht-existierende Tabelle**: `deploy_logs` existiert in keiner Migration. Der Supabase-Error wurde still geschluckt, `count` war `null` → Rate-Limit komplett deaktiviert ohne Fehlermeldung.
4. **`getDeployStatus` prüfte `res.ok` nicht**: Bei Vercel-API-Fehler (401, 404) wurde trotzdem `.json()` geparst und `UNKNOWN` zurückgegeben statt des echten Fehlers.
5. **>100 Dateien wurden silent truncated**: Projekte mit >100 Files wurden ohne Warnung mit nur 100 Files deployed.

**Was wurde geändert:**
- Token-Cache wird bei 401/403 von Vercel-API sofort geleert → nächster Deploy-Versuch holt frischen Token aus DB
- `Promise.allSettled()` statt `Promise.all()` → einzelne fehlgeschlagene Datei-Downloads crashen nicht mehr den gesamten Deploy
- Rate-Limit nutzt jetzt `projects.last_deployed_at` (existierende Tabelle) statt der nicht-existierenden `deploy_logs`
- `getDeployStatus`: prüft `res.ok` + wirft bei Auth-Fehler und leert Cache
- Warnung im SSE-Fortschritts-Stream wenn >100 Dateien vorhanden

**Warum wird es nicht mehr auftreten:**
Token-Cache hat jetzt einen Invalidierungs-Pfad. Alle null-Fälle sind durch `Promise.allSettled` + explizite Checks abgedeckt. Rate-Limit-Middleware verwendet eine tatsächlich existierende Tabelle.

---

## Gefundene und gefixte Bugs

| Bug | Severity | Fix |
|---|---|---|
| IDOR: `/api/chat/stream` prüfte keine Project-Ownership → User A konnte in Projekte von User B schreiben | P0 | Ownership-Check vor Stream eingefügt |
| Vercel token cache nie invalidiert → 401-Loop nach Token-Rotation | P0 | Cache-Clear bei 401/403 von Vercel API |
| `deploy_logs` Tabelle nicht vorhanden → Rate-Limit silent disabled | P0 | Auf `projects.last_deployed_at` umgestellt |
| `content!` null crash in vercel-service → unkontrollierter 500 | P0 | `Promise.allSettled` + null-filter |
| `getDeployStatus` kein `res.ok`-Check → UNKNOWN statt Fehlermeldung | P0 | `res.ok` Check + sprechende Errors |
| >100 Dateien silent truncated → incomplete deploys | P0 | Warnung im SSE-Stream |
| `byok-keys.ts` POST: `parse()` statt `safeParse()` → ZodError crasht zu 500 | P0 | `safeParse()` + try/catch mit richtigen Status-Codes |
| `byok-keys.ts` PATCH: returned `null` mit 200 wenn Key nicht gefunden | P1 | 404 wenn `updated` null |
| `byok-keys.ts` DELETE: kein try/catch → unhandled 500 bei DB-Fehler | P1 | try/catch + 500 mit message |
| Chat SSE stale closure: delta-Events verloren Tokens bei schneller Ankunft | P1 | `streamingContentRef` + `baseMessagesRef` für synchrones Accumulation |
| `chat-tab.tsx` Error-Handler nutzte stale `messages` closure | P1 | Auf `baseMessagesRef.current` umgestellt |
| `.env.example` gelöscht → neue Env-Vars (Free-API Pool) undokumentiert | P2 | Wiederhergestellt + alle neuen Vars dokumentiert |

---

## Noch offene Issues

| Issue | Severity | Aufwand |
|---|---|---|
| Migration 0016 (`preview_url`) nicht auf Supabase Production deployed | P0 | Klein — `supabase db push` oder SQL in Studio |
| Chat SSE: `getSession()` statt `getUser()` → Tokens könnten nach 1h expired sein ohne Refresh | P1 | Klein — aber Next.js SSR middleware refresht bei Navigation |
| `chat-tab.tsx`: kein AbortController für Stream bei Unmount → Memory Leak bei Navigation | P1 | Mittel |
| File-Path-Bug in `github.ts`: `fullPath.replace(projectId/)` — listFiles gibt relative Pfade zurück, kein Präfix | P1 | Klein |
| `byok_keys.key_encrypted` ist BYTEA in Schema aber Code speichert base64 String | P2 | Mittel — Migration um column type zu ändern, oder explizit dokumentieren |
| Kein CI/CD Pipeline (typecheck + lint on PR) | P2 | Mittel |
| Kein Test-Suite | P2 | Groß |
| Goblin-gehostete Modell-Layer (Phase 3) komplett Placeholder | P3 | Groß |

---

## Environment Variables Checklist

### Railway (API)
- ✅ `NEXT_PUBLIC_SUPABASE_URL` — benötigt
- ✅ `SUPABASE_SERVICE_ROLE_KEY` — benötigt
- ✅ `SUPABASE_JWT_SECRET` — benötigt (startup-validation)
- ✅ `ENCRYPTION_KEY` — benötigt (startup-validation)
- ⚠️ `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — nur für GitHub OAuth
- ⚠️ `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_*` — nur für Billing
- ⚠️ `STORAGE_ENDPOINT` / `STORAGE_KEY` / `STORAGE_SECRET` / `STORAGE_BUCKET` — optional (in-memory fallback aktiv wenn fehlt)
- ⚠️ `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — optional (Push Notifications)
- ⚠️ `ADMIN_API_KEY` — optional (Admin-Routen)
- ⚠️ `GOOGLE_FREE_API_KEY` — optional (Free-API Pool Layer 2)
- ⚠️ `GROQ_FREE_API_KEY` — optional (Free-API Pool Layer 2)
- ⚠️ `CEREBRAS_FREE_API_KEY` — optional (Free-API Pool Layer 2)
- ⚠️ `OPENROUTER_FREE_API_KEY` — optional (Free-API Pool Layer 2)

### Vercel (Frontend)
- ✅ `NEXT_PUBLIC_SUPABASE_URL` — benötigt
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` — benötigt
- ✅ `NEXT_PUBLIC_API_URL` — benötigt (zeigt auf Railway-URL)
- ⚠️ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — nur für Billing-UI
- ⚠️ `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — nur für Push-Notifications

**Legende:** ✅ muss gesetzt sein | ⚠️ optional / feature-abhängig

---

## Git-Stand

| Commit | Beschreibung |
|---|---|
| `e1cc72e` | fix: Vercel deploy reliability + auth hardening (P0) |
| `30b9b83` | fix: stream stale closure — tokens no longer lost under fast SSE (P1) |

Branch: `master` — up to date mit `origin/master`. Letzter Vercel-Deploy: ✅ success (2026-04-29T02:06:17Z).

---

## Nächste Schritte (Prio-Reihenfolge)

1. **Migration 0016 deployen** — `supabase db push` — Preview Tab funktioniert danach vollständig
2. **AbortController in `chat-tab.tsx`** — beim Unmount Stream abbrechen
3. **GitHub Push File-Path-Bug fixen** — `apps/api/src/routes/github.ts` Zeile ~120
4. **BYOK `key_encrypted` Column Type klären** — BYTEA vs TEXT
5. **CI/CD** — GitHub Actions: typecheck + lint bei PR
