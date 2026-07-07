# FEEL-4 — Merge Report
**Kontext & Persönlichkeit · merged & deployed 2026-07-07**

## Merge & deploy
- **Merge SHA:** `89591cf` (`--no-ff` merge of `feel-4` into `master`, 8 unit commits + 1 merge).
- **Deploy verified:** both surfaces serve `89591cf` —
  - API (Railway) `GET /api/version` → `gitCommit: 89591cf…`
  - Web (Vercel) `GET /api/version` → `gitCommit: 89591cf…`
- **Suites:** 454/454 API vitest green; recursive tsc clean (api verified separately).

## Units
| Unit | What shipped | Live now? |
|------|--------------|-----------|
| **F4.1** | Per-project **Anweisungen** (≤2k) injected above the rolling memory; memory made **visible + resettable** ("Stand & Entscheidungen" + "Gedächtnis zurücksetzen"). Hub card `ProjectInstructionsCard`. | **Yes** — instructions column (0046) + project_state (0076) already applied. |
| **F4.2** | Global **"Wie Goblin arbeitet"** (Anrede/Name, Antwortstil, Erklärtiefe), injected into all chats + agent runs. `custom_instructions` placebo fixed (now injected). | Partial — `custom_instructions` **live**; the 3 structured prefs **dark until migration 0082 applied**. |
| **F4.3** | Provider-agnostic **search adapter** (interface + Brave), agent-only **`web_search`** tool (max 3/run, daily cap 25), citation few-shot, capability/refusal made conditional, composer affordance in agent chats, connectors **Websuche live** + **Brave own-key** connector (cap-exempt). | **Yes (platform path)** — Railway has `BRAVE_SEARCH_API_KEY`. User-key path dark until migration 0083. |
| **F4.4** | Settings audit — inventory, criteria 1–5, Phase-C fix (custom_instructions), founder decision table. | Doc: `SETTINGS_AUDIT.md`. |

Commits: `5d303d8` `6de5260` (F4.1) · `7383219` (F4.2) · `5c27726` `6554dae` `e2589f4` (F4.3) · `1bc192b` (F4.4) · `fb3c46a` (test align).

## Probe evidence (real model, prod — `_sprint/feel-4/prod/`)
- **6.1 — instructions honored, unprompted · PASS (live).** Project instructions `"Alle UI-Texte auf Englisch. Farbschema: violett."`; a prompt that never mentioned English/violet produced `<html lang="en">`, English copy ("Elevate Your Digital Experience" / "Get Started Today"), violet scheme. Real `goblin/efficient` agent run.
- **6.4 — web_search · PASS (live).** Visible `web_search` step (5 Brave hits), cited current Tailwind (`v4.0` / `4.3.2`, `Quelle: <url>`), draft saved. Per-run cap 3 + daily cap 25 enforced (unit-proven); Railway `platform:true`.
- **6.2 — memory reset → honest no-history · endpoint PASS (live).** `DELETE /:id/state` returns success and clears the row → the existing E3 no-history prompt path applies. Behavior unchanged/tested.
- **6.3 — preferences flip · BLOCKED-pending-0082 (unit-proven).** Prod `PUT /preferences` returned `prefsPersisted:false` (columns absent, tolerant path worked). Both-direction behavioral flip proven deterministically (`feel4-context.test.ts`); live flip available the moment 0082 is applied.
- **6.5 / W9 register — web question now answered with the new truth** (agent CAN search, base chat honestly cannot); identity probes unchanged (goblin-agent-system tests green).
- **Deterministic gate tests:** `feel4-context.test.ts` (F4.1/F4.2 injection + F4.3 capability), `web-search.test.ts` (provider-agnostic mock provider, per-run + daily caps, cap-exempt user key).

## Settings audit — founder decisions (see SETTINGS_AUDIT.md §Phase C)
| Control | Violates | CC recommendation |
|---------|----------|-------------------|
| `memory_enabled` toggle | #1 placebo (nothing reads it), #2 | **Remove** — F4.1 now gives real per-project memory control; or wire with an explicit default-on migration. |
| `notify_*` toggles | #1 placebo (no send path), #2 | **Relabel "Bald"** (matches house pattern) or remove until a send path exists. |
Both deliberately NOT changed unilaterally (product/behavior calls).

## Migration flags (AUTHORED, NOT APPLIED — founder applies)
- **`0082_user_work_preferences.sql`** — 3 nullable `users` columns for F4.2. Until applied, the 3 structured prefs are inert (code tolerant, saves never 500). Apply → F4.2 live + probe 6.3 flips.
- **`0083_byok_brave_provider.sql`** — whitelists `'brave'` in `byok_keys` provider check for the user-key connector. (Live DB likely already tolerates it as it does `'vercel'`; apply to make it explicit.)

## Key reminders
- **Railway `BRAVE_SEARCH_API_KEY` is present** (confirmed live: `platform:true`) — the founder's F4.3 pre-step is done; web search is live in prod agent chats.
- **The goblin-hosted model key may be revoked AFTER this wave** per the sprint note — say the word; nothing in FEEL-4 hard-depends on it beyond the standard agent/chat runs.
- Screenshots (F4.2/F4.4 viewport+theme) **not captured** — prod is auth-walled and credential entry is out of policy; UI is tsc-clean, deployed, API-verified. Low-risk follow-up.

## Next
Founder gate: paste the **WALK-2** prompt for Steven's feeling re-grade; then the open-items runbook decides user-go. **HALT.**
