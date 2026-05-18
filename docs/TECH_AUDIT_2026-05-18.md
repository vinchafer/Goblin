# Tech Audit — DD V2 Preparation

**Datum:** 2026-05-18
**Branch:** master @ `c627450`
**Zweck:** Faktenbasiertes Snapshot für Investor-Tech-DD V2. Keine Marketing-Sprache.

---

## 1. Codebase Stats

| Metric | Value |
|---|---|
| Total commits | **242** |
| Commits last 14 days (since 2026-05-04) | **142** (59% of repo) |
| Web LOC (`apps/web/{app,components,lib}`, .ts/.tsx) | **25,496** |
| API LOC (`apps/api/src`, .ts) | **9,214** |
| Shared packages LOC | **725** |
| Web files (.ts/.tsx) | 209 |
| API files (.ts) | 72 |
| Migrations | 41 |
| E2E specs | 38 |
| Runtime deps: web / api / shared | 26 / 20 / 3 |
| Dev deps: web / api / shared | 8 / 8 / 1 |

### Sessions 9D → 10A (chronologisch)

| Session | Hash | Datum | Beschreibung |
|---|---|---|---|
| 9D-0 | `4a3abb7` | ~05-15 | UI foundation primitives (BottomSheet, IOSToggle) |
| 9D-1 | `c81d964` | 05-15 | Settings bottom-sheet + ProfileCard |
| 9D-2 | `a2bb3a2` | 05-15 | ProfilePage + security placeholders |
| 9D-3 | `d0af3b2` | 05-15 | FeaturesPage with IOSToggle |
| 9D-4 | `d146507` | 05-15 | BYOK API Keys page + usage schema |
| 9D-5 | `a130e31` | 05-15 | Empty chat greeting + composer popover |
| 9D-6 | `5d23b9f` | 05-15 | AvatarMenu BottomSheet |
| 9D-7 | `f254e2d` | 05-15 | FilterPills primitive |
| 9D-8 | `b4bc3a4` | 05-15 | Session summary + 9E backlog |
| 9C-fix | `806d74b` / `ce51e55` / `e7c6ffb` / `a4f0631` | 05-15→16 | E2E sync after 9D |
| 9B-0 | `a40196b` | 05-16 | Sentry + env schema |
| 9B-1 | `54a427e` | 05-16 | Heartbeat + health E2E |
| 9B-2 | `5c6dfda` | 05-16 | Billing cost tracking + admin |
| 9B-3 | `344f8e4` | 05-16 | Operations runbook |
| 9B-4..7 | `1a8743c`..`d562c3c` | 05-16 | Eval framework (schema, runner, dashboard) |
| 9B-8 | `5b51faf` | 05-16 | Session summary |
| 9P | `1bc803c` / `15a851e` | 05-17 | iPhone polish (18 findings) + E2E sync |
| 9R | `365e6ed` / `172f678` | 05-17 | Model intelligence layer (5 adapters) |
| Build-fix | `0aef016` | 05-18 | tsup→deps + ENABLE_CRON |
| 10A | `9133cdc` / `a8863fe` / `cda973e` / `c627450` | 05-18 | LiveBench disable + SWE-Bench rewrite + canonicalize + admin polish |

---

## 2. Production Health

### Endpoints (live check 2026-05-18 ~17:50 UTC)

| Endpoint | Result |
|---|---|
| `https://justgoblin.com/api/version` | 307 → `www.justgoblin.com` (Vercel) — kein direkter `/api/version`, frontend liefert HTML |
| `https://goblinapi-production.up.railway.app/version` | `{"version":"0.2.0","gitCommit":"c627450f4898…","buildTime":"2026-05-18T17:49:22Z","env":"","apiReady":true}` |
| `https://goblinapi-production.up.railway.app/health` | `{"status":"ok","timestamp":"2026-05-18T17:49:23Z","version":"0.2.0"}` |
| `/api/rankings?task=coding&limit=5` | 5 Modelle, OpenRouter+Aider mixed. SWE-Bench-Modelle in Top-50 nicht repräsentiert (Composite-Weight-Issue, kein Bug). |

Top-5 Coding (composite):
1. inclusionAI Ling-2.6-flash (1.000, src=openrouter)
2. gpt-5 (high) (0.971, src=aider)
3. o3-pro (high) (0.960, src=aider)
4. gemini-2.5-pro-preview (0.948, src=aider)
5. gpt-5 (medium) (0.946, src=aider)

### GitHub Actions — letzte 10 Runs

- **Success: 8 / 10** (80%)
- **Failure: 2 / 10** — beide `E2E Tests` workflow (15:50, 14:13 UTC) — flake bekannt (siehe Section 4)
- CI Typecheck/Build: 100% grün
- Performance Budget: 100% grün

### Vercel Deploy

- Live + healthy (Etag `ad5ef6f5…`, CSP gesetzt, Sentry-bundler-plugin in deps)
- Exakter Deploy-Commit-Hash: **data not available** ohne Vercel-API-Key
- Backend-Frontend-Coherence: Frontend connect-src whitelisted `goblinapi-production.up.railway.app` — passt.

---

## 3. Tech Debt Inventory

Kategorisiert aus `docs/9E_BACKLOG.md` (132 Zeilen, 12 Sections).

### P0 — Blocker (Production / Security / DD)

| Item | Begründung |
|---|---|
| **Konto löschen Confirm-Flow** (Stub) | GDPR Art. 17 Recht auf Löschung — fehlende Implementierung ist Compliance-Risk. |
| **Password change flow** (Stub) | Basis-Auth-Hygiene, derzeit alert-Stub in ProfilePage. |
| **GROQ_FREE_API_KEY removal Railway** | Pre-existing Layer-B cleanup; geteilter Free-Pool-Key ist Cost-Bombe + ToS-Risiko. |
| **pnpm audit: 10 high CVEs** (siehe Section 4) | Production-Dependency-Vulns, transitive via Sentry & Vitest. |
| **Backup-Restore-Drill** | Kein dokumentierter Restore-Test → kein RTO/RPO-Beweis für Investor. |

### P1 — Soon (next 4 Wochen)

- **2FA TOTP** + **Active Sessions** (ProfilePage Stubs) — Security-Story für DD
- **LiteLLM BYOK-Usage-Write-Hook** — Read-Pfad live, Write fehlt → Usage-Tracking unvollständig
- **Monthly BYOK-Reset Cron** — Period-Start-Logic fehlt
- **Stripe Tax activation** — Billing-Compliance pre-existing
- **Supabase Custom Domain** `auth.justgoblin.com` — Branding + Cookie-Domain
- **Slack/Email Sentry Alert Webhook** — Vincent muss aktiv pollen ohne
- **Better-Stack SMS-Routing** — Pager-Coverage für Solo-Dev
- **API per-user Rate-Limiting** — Cost-Schutz vs Free-Tier-Missbrauch
- **E2E Flake `26-settings-structure profile-save`** — User-Metadata-Propagation-Race
- **E2E `29-empty-and-context`** retag aus `@local-only` zurück

### P2 — Eventually

- **Passkeys / WebAuthn** (ProfilePage Stub)
- **Chat-Workflow Live-Actions** (Pin/Rename/Share/Move/Archive)
- **ComposerPlusPopover Actions** (Upload/Screenshot/GitHub/Research/Websearch)
- **Project-Detail-Page Description/Files/Anweisungen/Favorites**
- **Settings polish** (Avatar Upload, Dark Mode, i18n, Accent, Sub-Pages real)
- **Eval-Framework upgrades** (TS-compile check, UI, regression-alerts, weighted-scoring, LiteLLM-routing)
- **Cost-Dashboard charts/leaderboard/threshold**
- **Web-Push + in-app Notification Center**
- **Avatar Menu Desktop-Popover Variante**
- **Model-Intelligence Paid APIs** (Artificial Analysis ~$50/Mo, eigene Mini-Evals ~$5/Mo)
- **TASK_WEIGHTS Tuning** (derzeit hardcoded)
- **ranked_models ↔ models JOIN** (statt Substring-Matching für EMPFOHLEN-Badge)

### Documentation
- **DD V2 doc update** mit 9D+9B-Status — Stream C pending Opus
- **Comparison-Doc Reference Screenshots** ergänzen
- **Architecture diagram refresh** + **Reviewable PDF export**

---

## 4. Known Bugs / Risks

### TypeScript Errors
- `pnpm --filter @goblin/api typecheck`: **0 errors**
- `pnpm --filter @goblin/web typecheck`: **0 errors**
- TODO/FIXME-Markers im Code: **0**

### Flaky E2E
- `26-settings-structure profile-save persists across reload` — bumped wait 1000→1500ms, ProfilePage save race vermutet (Supabase `updateUser` round-trip vs `getUser()`)
- `static.spec.ts /status` — pre-existing, passes on retry
- `29-empty-and-context.spec.ts` — retagged `@local-only`, NewChatPage POST 401/500 intermittent

### Disabled Features (intentional)
- `model_sources.enabled = false` für **livebench** (Migration 0041, kein offizieller Daten-Export, GitHub issue #82 seit Nov 2024 offen)
- `LiveBench`-Adapter-Code bleibt als Skelett für Re-Enable

### Security Audit (`pnpm audit --audit-level=moderate`)

| Severity | Count |
|---|---|
| High | **10** |
| Moderate | 14 |
| Low | 3 |
| **Total** | **27** |

Hauptpfade: transitiv über `@sentry/node`, `@sentry/nextjs`, `@vitest/coverage-v8`. Beispiel: `brace-expansion <5.0.6` (GHSA-jxxr-4gwj-5jf2). Direkte Goblin-Deps nicht direkt verwundbar; Auflösung via `pnpm overrides` möglich.

### Production Risks (qualitativ)

- **Solo-Dev-Bus-Factor = 1** — kein Co-Founder, kein Code-Reviewer
- **Keine Staging-Env** — Railway prod = nur Env; Tests laufen lokal + CI
- **Keine Migration-Rollback-Tests** — `supabase/migrations/*.sql` linear forward-only
- **BYOK-Encryption** läuft via `ENCRYPTION_KEY` env (single per-instance key, kein per-tenant Vault) — pre-existing DD-Condition #4
- **Kein Audit-Log** für sensitive Operations (BYOK-Key-Add, Account-Delete)
- **Eval-Framework** existiert (9B-4..7), aber Scoring substring-basiert (kein TS-Compile-Check) — Real-Quality-Beweis schwach

---

## 5. Capacity Assessment

### Realistisch in 4 Wochen (Solo-Vincent, ~25h/Woche dediziert)

**Machbar:**
- P0-Items 1-3 (Konto-Delete-Confirm, Password-Change, GROQ-Key-Removal): ~3-5h zusammen via Claude Code
- pnpm-audit-cleanup via `pnpm overrides` + Sentry-Update: ~2-4h
- LiteLLM-BYOK-Write-Hook: ~3-5h
- Stripe Tax activation: ~1h (Dashboard-Click)
- Supabase Custom Domain: ~1-2h (DNS + Config)
- Slack/Email Sentry-Webhook: ~1h
- Backup-Restore-Drill (Script + Runbook): ~4-6h
- E2E Flake-Fixes (26 + 29 + static): ~3-5h

**Wahrscheinlich nicht in 4 Wochen:**
- 2FA TOTP komplett (otpauth + QR + 10 backup-codes + verify-flow + recovery): ~10-15h alleine
- Eval-Framework Real-Compile-Check: ~8-12h
- Cost-Dashboard Charts + Threshold-Alerts: ~6-10h

### Braucht externe Hilfe

- **Co-Founder Production-Engineering** (pre-existing DD-Condition #1) — bus-factor + on-call
- **Security-Audit** (DD-Condition #5) — externer Pen-Test ~$3-8k
- **BYOK-Vault-Architecture** (DD-Condition #4) — Hashicorp Vault oder AWS KMS Integration, mehrwöchig
- **Eval-Pipeline-Engineer** (DD-Condition #6) — externe Validierung, ~2 Wochen Contractor

### Autonom-buildbar via Claude Code (5-10h Sessions)

- Settings Sub-Pages real (Notifications/Privacy/Personalization/Konnektoren)
- Avatar Upload (B2 storage)
- Dark Mode Switch wire-up
- Chat-Workflow Actions (Pin/Rename/Archive — Backend existiert)
- ComposerPlusPopover Actions (Upload/Screenshot via B2, GitHub-OAuth-Connect)
- TASK_WEIGHTS-Tuning + ranked_models JOIN
- API per-user Rate-Limiting (LiteLLM-Layer)
- Trend-Charts per Modell

---

## 6. Investor-Readiness Checklist

### Assets — was Goblin gut zeigt

- **Velocity:** 142 Commits in 14 Tagen, 8 abgeschlossene Sessions (9D, 9B, 9P, 9R, 10A) mit klarer Dokumentation
- **TypeScript Clean:** 0 TSC errors, 0 TODO/FIXME-Markers
- **Test Coverage:** 38 E2E specs, 45 unit tests grün (12 canonicalize, 13 pricing, 11 encryption, 9 pricing-calc)
- **CI:** 8/10 letzte Runs grün, Typecheck+Build 100% grün
- **Model Intelligence Layer (9R/10A):** 4/5 Quellen live, 978 Modelle, 2630 Rankings, öffentliche `/api/rankings`-API, /models-UI
- **Observability:** Sentry für api+web, Heartbeat-Ping, Health-Endpoint, Better-Stack-Bereit
- **Billing:** Stripe live, Cost-Tracking-Schema, Admin-Cost-Dashboard
- **Eval-Framework:** Schema + 5 Seed-Tasks + Runner (4 Provider) + Scorer + Daily-Cron + Admin-UI
- **Operations:** Dedizierter Runbook (`docs/operations`), Sentry-Edge-Config, Env-Schema-Validation
- **BYOK existiert:** Verschlüsselt at rest, Read-Pfad live, Usage-Tracking-Schema gesetzt
- **Mobile-First-UI:** 9P-Polish-Pass auf echtem iPhone, BottomSheet-System, iOS-Toggle-Pattern

### Gaps — was im Tech-DD durchfallen würde

- **Bus-Factor 1** — Solo-Dev, kein Reviewer (DD-Condition #1 ungelöst)
- **10 high-severity CVEs** in transitive Deps (lösbar mit `overrides`, aber ungelöst)
- **BYOK-Encryption** ist single ENCRYPTION_KEY, nicht per-Tenant-Vault (DD-Condition #4)
- **Kein 2FA** für BYOK-User (DD-Condition #5)
- **Eval-Framework** existiert, aber Scoring substring-basiert — kein echter Code-Quality-Beweis (DD-Condition #6)
- **Kein Audit-Log** für Account-Delete / BYOK-Key-Operations
- **Backup-Restore-Drill** ungeprüft — RTO/RPO claim unverbar
- **Migration-Rollback** ungetestet (linear forward only)
- **Keine Staging-Env** — Test-Flow ist lokal + Prod
- **DD-Condition #7 (Differentiation Story)** noch nicht refresh-ed seit 9R

### Production-Critical noch ungelöst

1. **GROQ_FREE_API_KEY** noch in Railway (Layer-B Free-Pool — Cost-Bombe wenn Throttle bricht)
2. **Konto löschen** ist Alert-Stub (GDPR Art. 17 Compliance)
3. **Password Change** ist Alert-Stub (Basis-Auth-Funktion fehlt UI-seitig)
4. **10 high CVEs** in Production-Deps
5. **API Rate-Limit pro User** fehlt (Free-Tier-Missbrauchs-Schutz)

---

## Datapoints not available

- Vercel-Deploy-Commit-Hash (kein API-Key konfiguriert, `/api/version` redirect)
- Genaue Definition der "high"-CVEs ohne `pnpm audit --json` Parse — Summary-only
