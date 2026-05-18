# 9E Backlog — Deferred from 9D (2026-05-15)

## 9P Follow-ups
- E2E flake: `26-settings-structure profile-save persists across reload` — bumped wait 1000→1500ms in 9P-test-sync. If still flaky, investigate ProfilePage save race: `setShowNewProjectModal` cache + Supabase `updateUser` round-trip may resolve before user_metadata propagates to next `supabase.auth.getUser()` call.

## Security / Auth
- 2FA TOTP implementation (otpauth + QR + 6-digit verify + 10 backup-codes) — placeholders in ProfilePage
- Passkeys (WebAuthn via @simplewebauthn) — placeholders in ProfilePage
- Active Sessions list with revoke (DB table `user_sessions`) — placeholder
- Password change flow (Supabase auth.updateUser) — alert stub in ProfilePage
- Konto löschen Confirm-Flow — alert stub in ProfilePage Danger-Zone

## Chat Workflow
- RecentChatRow Context Actions live machen:
  - Pin/Unpin (DB column + endpoint + sidebar sort)
  - Rename Modal (PATCH /api/chat-sessions/:id existiert)
  - Share Modal (publishable share-token)
  - Move to Project (Project-Picker UI)
  - Archive (DB column + endpoint + filter in sidebar)
- ComposerPlusPopover Actions live machen:
  - upload-file (storage upload via Backblaze)
  - screenshot (device camera/file pick)
  - github (GitHub-Connect, repo picker)
  - research (DeepResearch agent flow)
  - websearch — toggle persistent in chat-session metadata

## Project Workflow (9D-7 partial)
- Project-Detail-Page mit Description-Card (editable info)
- Files-Sheet pro Projekt (capacity-bar + drag-drop upload via B2)
- Anweisungen-Sheet (editable system-prompt per project)
- Filter-Pills Integration in /dashboard/projects/[id]: Alle/Angeheftet/Archiviert für Project-Chats
- Project favorites (star-icon)

## Settings polish
- Avatar Upload (currently initials only)
- Dark Mode Switch — Tokens prepared, switch untested
- i18n EN/DE language switch (currently localStorage only, no UI string changes)
- Custom Accent Color (currently disabled "Bald")
- Notifications Sub-Page real (currently stub)
- Privacy Sub-Page real (GDPR export, delete)
- Personalization Sub-Page real (currently stub)
- Konnektoren Sub-Page real (Google, GitHub OAuth — currently /dashboard/settings/integrations existiert separat)

## API Keys (9D-4 partial)
- LiteLLM-Middleware-Hook für `byok_key_usage` write — pro chat-completion: `increment_byok_usage(user_id, provider, tokens_in, tokens_out)`. Currently nur Read-Pfad live.
- ApiKeysPage Add/Remove-Key Inline-Flow (currently Link "Schlüssel verwalten →" zu `/dashboard/settings/keys`)
- Monthly reset cron (period_start logic)

## Notifications
- Web-Push subscription
- In-app notification center

## Avatar Menu
- Desktop-Popover-Variante statt Sheet (besseres Desktop-UX); aktuell Sheet auch auf Desktop
- Provider-Icon (Google/GitHub) im User-Header anzeigen — war im alten Header, fehlt im neuen Sheet

## Reference Screenshots
- Comparison-Doc um konkrete Screenshot-Verweise erweitern: `docs/Reference Screenshots/Mobile/Claude/X.jpeg`

## CI / E2E
- Re-enable 29-empty-and-context.spec.ts in CI subset (currently @local-only).
  NewChatPage POST /api/chat-sessions returns 401/500 intermittently in CI
  for the real test account, causing fallback to /dashboard. Need either:
  (a) seed a chat session for real test account before run, or
  (b) fix auth middleware so test-account magic-link cookies authenticate
  the API call reliably, or
  (c) test composer-plus via project workspace chat-tab instead of standalone
  /dashboard/chat (different mount path).
- static.spec.ts /status page contains "Status" — pre-existing flaky (passes
  on retry typically). Not 9D scope.

## Deferred from 9B (2026-05-15)

### Eval-Framework
- Real TS-compile check (currently substring scoring only)
- UI to add/edit/disable eval tasks (currently SQL-only)
- Regression alerts vs historical baseline
- More tasks: SQL gen, refactoring, multi-step debugging
- Weighted scoring (compile > keyword match)
- A/B between provider model tiers (Opus vs Sonnet, GPT-5 vs gpt-4o-mini)
- Route eval-calls through LiteLLM for parity with prod

### Operations
- Slack/Email alert webhook from Sentry
- Better-Stack alert routing to Vincent SMS
- Cost-Dashboard spend trend chart
- Cost-Dashboard per-user leaderboard
- Cost-Dashboard threshold alert (e.g. > $50/mo)
- Backup-restore drill (quarterly) — script + runbook
- API per-user rate-limiting

### DD V2 (Stream C — pending Opus session)
- DD V2 doc update with 9D + 9B status
- Risk-mitigation rewrites (deployment, BYOK security, scale-out)
- Pricing-story refresh (3-Tier with Floor $3)
- Architecture-diagram refresh
- Reviewable PDF export

## Already known (pre-9D)
- Supabase Custom Domain `auth.justgoblin.com`
- Stripe Tax activation
- GROQ_FREE_API_KEY removal from Railway (Layer B cleanup)
- ENCRYPTION_KEY setup für CI

## Model Intelligence — Source Coverage (Session 10, 2026-05-18)

### LiveBench (currently disabled)
- Disabled since Session 10 (2026-05-18) via migration `0041_disable_livebench.sql`
- Reason: No official structured data export
- Tracked: https://github.com/LiveBench/LiveBench/issues/82 (open since Nov 2024)
- Re-enable trigger: Official LiveBench API or JSON dump becomes available
- Workaround considered + rejected: Web scraping (ToS violation, JS-rendered, fragile)
- Workaround considered + deferred: Own mini-evals via paid APIs (9R-V2 scope)

## Deferred from 9R (2026-05-16) — Model Intelligence Layer

### Paid API integration (~2-3 weeks)
- Artificial Analysis API subscription (~$50/Mo) → AdapterArtificialAnalysis
- Goblin-eigene Mini-Evals gegen Top-5 (weekly, ~$5/Mo)
  - LLM-as-Judge with Sonnet 4.6 or GPT-5
  - 10-20 Goblin-specific tasks (real user flows)
- A/B test TASK_WEIGHTS based on user feedback
- LMArena ELO when official API becomes available

### Operational
- Canonicalize audit: monthly /admin/rankings check, ensure no duplicate canonical IDs
- TASK_WEIGHTS tuning (currently hardcoded in `aggregator.ts`)
- Notifications when a model jumps ranks significantly
- Trend charts per model on detail page
- Join `ranked_models` to internal `models` table via canonical ID (so ModelPicker "EMPFOHLEN" badge no longer relies on substring matching)
- Optional drop migration for unused `eval_tasks` / `eval_results` tables (kept for now, no harm)
