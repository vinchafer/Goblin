# FEEL-4 F4.4 — Settings-Audit
**Steven's criteria, executed by CC · branch `feel-4` · 2026-07-07**

Criteria applied to every control:
1. **Wirkt es?** — does it demonstrably change behavior (placebo = a lie in toggle form)
2. **Ehrlich beschriftet?** — label matches verified behavior
3. **Auffindbar?** — linked from where the need arises (JIT)
4. **Braucht es Max?** — dev-only → behind "Erweitert" or removed
5. **Konsistent?** — same terms as the rest of the product (house glossary)

Screenshots (375px + desktop, dark+light) are captured in the consolidated evidence run
and referenced as `_sprint/feel-4/shots/<name>.png`. Behavior columns below are **code-verified**,
not claimed.

---

## Phase A — Inventory (every settings surface/control)

Settings render **twice** (documented dup): desktop registry `components/settings/sections.ts` +
mobile sheet `components/settings/SettingsRoot.tsx`. Adding/removing a section touches both.

| # | Control | Surface (file) | Claims | Verified behavior (code) | Linked from |
|---|---------|----------------|--------|--------------------------|-------------|
| 1 | Anzeigename / Username / Bio | PersonalizationPage | Profile identity | Real — `supabase.auth.updateUser` metadata; resolved by `resolveDisplayName` everywhere | Settings → Personalisierung |
| 2 | **Anweisungen für Goblin** (custom_instructions) | PersonalizationPage | "included in every chat" | **FIXED this wave (F4.2)** — now injected globally via `renderUserContext`. Was a placebo (stored, never read) before feel-4 | Settings → Personalisierung |
| 3 | **Wie Goblin arbeitet** — Anrede/Name, Antwortstil, Erklärtiefe | PersonalizationPage (NEW, F4.2) | Change greeting/register/explain-depth | Real — injected globally, each proven to flip behavior (prompt-builder test); stored on `users` (0082, authored) | Settings → Personalisierung |
| 4 | **Erinnerung** (memory_enabled) toggle | PersonalizationPage | "Let Goblin remember context from chats" | **PLACEBO** — read nowhere; `scheduleProjectStateUpdate` runs regardless of it. Default `false`. → decision table | Settings → Personalisierung |
| 5 | Abrechnung / Nutzung | Billing/Usage pages | Plan + usage | Real (Stripe + usage counters) | Settings → Konto |
| 6 | Erscheinungsbild (Appearance) | SettingsRoot | Theme | Real (theme switch) | Settings → Design |
| 7 | Akzentfarbe (Accent color) | SettingsRoot `:182` | — | **Honest** — disabled, labeled "Bald/Soon", not focusable. OK (roadmap, not placebo) | Settings → Design |
| 8 | Eingabesprache (Input language) | SettingsRoot / LanguagePage | UI language | Real (`goblin:preferred-lang`) | Settings → App |
| 9 | Benachrichtigungen (notify_build_complete / important_updates / email) | NotificationsPage + PreferencesSchema | Notification prefs | **PLACEBO** — stored on `users`; **no send path reads them** (grep: 0 hits outside account.ts). No email/push infra wired. → decision table | Settings → App |
| 10 | Haptisches Feedback | FeaturesPage / SettingsRoot | Haptics on tap | **Real** — `goblin-haptic` read by `SettingsRoot`, `RecentChatRow` | Settings → App / Funktionen |
| 11 | Datenschutz / Hilfe / Über | Privacy/Help/About | Info | Real (static/info) | Settings → App / Hilfe |
| 12 | **Konnektoren** — GitHub, Vercel | ConnectorsPage | Connect services | Real (OAuth / token, encrypted) | Settings → Konnektoren |
| 13 | **Konnektoren — Websuche + Brave (eigener Key)** (NEW, F4.3) | ConnectorsPage | Live web search in agent chats + own-key | Real — platform key = live+capped; own Brave key = cap-exempt | Settings → Konnektoren |
| 14 | Konnektoren — Supabase/Stripe/Domain | ConnectorsPage `SoonSection` | — | **Honest** — "Bald" cards, `aria-disabled`, not clickable/focusable. OK | Settings → Konnektoren |
| 15 | **Projekt-Anweisungen + Gedächtnis** (NEW, F4.1) | Project hub `ProjectInstructionsCard` | Per-project rules + visible/reset memory | Real — instructions injected above memory; memory read/reset endpoints | Project hub (JIT — where the project lives) |
| 16 | Layout ändern (intent) | ProjectIntentControl | Code-tab default layout | Real (PATCH intent) | Project hub |

Former phantom toggles ("Websuche/Erinnerung/Spracheingabe" on FeaturesPage) were already
removed in the honesty sprint (F3) — `FeaturesPage.tsx` header comment confirms. No regression found.

---

## Phase B — Criteria verdicts

- **#1 Wirkt es?** Two live placebos found: **#4 memory_enabled** and **#9 notify_***. **#2 custom_instructions
  was a placebo — fixed this wave.** All F4.1/F4.2/F4.3 new controls verified behavioral.
- **#2 Ehrlich beschriftet?** #4's label ("Let Goblin remember…") actively implies a gate that does not exist —
  the worst kind (a lie). #9 implies notifications are sent. Both fail #2 as a consequence of failing #1.
- **#3 Auffindbar?** New controls placed JIT per criterion: F4.1 (project rules/memory) on the **project hub**,
  not buried in global settings; F4.2 (how Goblin works) in **Personalisierung**; F4.3 Websuche near the other
  **connectors** + a JIT own-key nudge at the composer/daily-cap. Model selection already near the composer;
  Vercel near publish. No new #3 violations.
- **#4 Braucht es Max?** No dev-only control surfaced to end users this wave. (BYOK own-key is opt-in, clearly labeled.)
- **#5 Konsistent?** Terms align with the house glossary ("Sichern/Veröffentlichen", "Anweisungen", "Stand &
  Entscheidungen"). No "Commit"/"Deploy" leaks introduced.

---

## Phase C — Fixes

### Applied this wave (clear cases)
- **C-1 · #2 custom_instructions placebo → real (commit `feat(prefs): F4.2`).** The "Anweisungen für Goblin"
  field was stored but never injected. Now wired into the global user block (`renderUserContext`), proven by
  the F4.2 prompt-builder test. Placebo removed by making it work — the honest fix.
- **C-2 · #3 placement of F4.1/F4.2 (commits F4.1 hub card + F4.2 section).** Per criterion #3, F4.1 lives on the
  project hub (where a project's rules belong) and F4.2 in Personalisierung — not a generic settings dump.

### Founder decisions (ambiguous — Steven-criteria applied)

| Control | Criterion violated | Options | CC recommendation |
|---------|--------------------|---------|-------------------|
| **#4 memory_enabled toggle** | #1 (placebo), #2 (label lies) | **A)** Wire it: gate `scheduleProjectStateUpdate` on it — but DB default is `false`, so this would silently DISABLE memory for existing users (regression) unless defaulted-on first. **B)** Remove the account-level toggle; F4.1 now gives real, per-project memory control (visible "Stand & Entscheidungen" + "Gedächtnis zurücksetzen"), which supersedes a global on/off. **C)** Keep, relabel honestly ("Gedächtnis-Verwaltung folgt") — still non-functional. | **B** — F4.1 makes the global toggle redundant and it currently lies. If a global kill-switch is wanted, do **A** with an explicit default-on migration. Not done unilaterally (behavior/data change = founder call). |
| **#9 notify_* toggles** | #1 (placebo — nothing sends), #2 | **A)** Build a real send path (email/push) — out of this wave's scope (non-goal). **B)** Relabel/disable as "Bald" until sending exists (honest). **C)** Remove until the feature is built. | **B** — cheapest honest state; matches the "Bald" house pattern already used for Akzentfarbe/SoonSection. Removal (C) also acceptable. Left for founder since notifications may be in-flight elsewhere. |

Both ambiguous items are **behavior/product changes**, deliberately NOT applied unilaterally (sprint hard rule:
isolated, reversible commits; no silent product decisions). They are one small commit each once the founder picks.

---

## Summary
- New controls this wave: all verified behavioral (no placebos shipped).
- One pre-existing placebo **fixed** (custom_instructions).
- Two pre-existing placebos **surfaced** for a founder decision (memory_enabled, notify_*), each with options.
- Honest roadmap controls (Akzentfarbe, Supabase/Stripe/Domain) pass — labeled "Bald", non-interactive.
