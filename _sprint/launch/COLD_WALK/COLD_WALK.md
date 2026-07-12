# COLD WALK — first-run code/copy audit (evidence only, no verdicts)

**Runbook 3 · Launch-readiness · branch `claude/launch-readiness-audit-spr8at`**
**Method:** CLOUD ADAPTATION (A) — the real browser cold-start on a fresh account
(`vinc.hafner4@`) is a **founder wifi-item** (see `GO_LIVE_CHECKLIST.md`); it cannot be
browser-driven in this sandbox. This file is a CODE/COPY audit: every first-run surface
was read in source and the actual user-facing strings quoted with `file:line`. Observations
only — classification and fixes live in `../LAUNCH_DECISIONS.md` and the Part-2 commits.

Language tags: **DE** = German, **EN** = English i18n. App shell is bilingual via
`t(lang, de, en)`; the marketing landing and the auth screen are English-only surfaces.

Strings marked **[v]** were re-read directly by this session; strings marked **[a]** were
gathered by a read-only sub-audit of the same files and not independently re-opened.

---

## 1. Signup → first screen

- `/register` is a server redirect, not a page: `app/register/page.tsx:8` → `redirect('/login?mode=signup')`. **[v]**
- The real form is `app/(auth)/login/page.tsx` — **English-only**, no i18n. **[a]**
- Heading `Create your account` (L450); subtitle `Free during beta · No credit card` (L454). **[a]**
- OAuth: `Continue with Google` / `Continue with GitHub` (L80–81). Email + Magic-Link/Password toggle. **[a]**
- Password field `Create password (min. 8 chars)`; strength `Weak/Fair/Strong` (L163–165). **[a]**
- Terms checkbox `I agree to the Terms, Acceptable Use and Privacy Policy` (L603). **[a]**
- Error toasts, all EN except one: `Incorrect email or password.` (L215), `No account found. Switch to "Create account" to sign up.` (L296). **[a]**
- **DE-in-EN leak** at `login/page.tsx:194`: the lockout toast rendered `Account vorübergehend gesperrt. Versuche es in ${mins} Min erneut.` — the only German string on an all-English screen. **[v]** → **fixed** (commit F1).
- Auth callback `app/auth/magic-callback/page.tsx`: `Signing in…` (EN); failure redirects surface raw query-string errors (`?error=No+token+found`) as toasts. **[a]**
- "vibe coding" is **not** defined on the signup screen (it is defined later in the `/welcome` flow — see §5). **[a]**

## 2. Empty states everywhere

- **Dashboard, 0 projects** — `app/dashboard/page.tsx`: the always-present hero is the real `ChatInput` (`variant="hero"`) under the title `Sag Goblin, was du bauen willst.` / `Tell Goblin what you want to build.` (L319–323), placeholder `Eine Landingpage mit Stripe-Bezahlung in Next.js…` (L331). The empty-state card `Bau dein erstes Projekt` / `Build your first project` + `Sag Goblin oben, was du bauen willst — Goblin schreibt den Code, du deployst.` sits below (L403–409). The first action **is** the visual focus. **[v]**  · jargon: `du deployst` / `you deploy` unexplained at point of use. **[v]**
- **Files empty** — `components/files/FileExplorer.tsx:384`: `Dieser Ordner ist leer.` `Lade oben rechts eine Datei hoch.` (DE only). Teaches weakly. **[a]**
- **Chat history empty** — `app/dashboard/chats/page.tsx:104`: was a bare `No chats yet` / `Noch keine Chats` with no next action. **[v]** → **fixed** (commit F2: added bilingual hint linking to the dashboard).
- **Connectors empty** — `components/settings/ConnectorsPage.tsx`: GitHub `Dein Code als echtes Git-Repo` + a `ConnectorHelp` block (what-it-does + 2 steps + `Dauer: ~1 Minute`); Vercel `Automatisches Deploy mit deinem Vercel-Token` + `~2 Minuten`. Teaches well. **[a]**
- **Settings landing** — `components/settings/SettingsRoot.tsx`: full labeled menu; `Akzentfarbe`/`Accent color` row shows `Bald`/`Soon` and is `disabled` (L185) — honest. **[a]**

## 3. First build attempt with zero setup (the Vercel wall, P1.11 JIT)

- Publish entry `components/code/SessionPane.tsx:549` (`liveStellen`): **pre-checks** Vercel connection before deploying; if unconnected it opens `VercelConnectSheet` rather than erroring, and a `NO_VERCEL_TOKEN` deploy error also opens the sheet with the raw prefix stripped (L596–597). **[a]**
- The JIT sheet `components/code/VercelConnectSheet.tsx` — bilingual, welcoming, not a dead-end **[v]**:
  - Title `Noch ein Schritt bis live` / `One step from live` (L69).
  - `Um live zu gehen, verbinde einmalig dein Vercel-Konto — das dauert etwa 2 Minuten.` (L80).
  - `Deine Seite läuft dann in deinem eigenen Vercel-Account — deine Deployments, deine Kosten, unter einer echten öffentlichen Adresse.` (L85) — reinforces the own-Vercel product model.
  - Steps: `In Vercel: Settings → Tokens → Token erstellen` + link `vercel.com/account/tokens ↗` (L91); `Token hier einfügen und verbinden`.
  - Fine print `Wird gegen die Vercel-API geprüft und verschlüsselt gespeichert. Nur Account-Ebene.` (L143). **[a]**
- **Preview tab dead-state** — `components/preview/preview-tab.tsx:78`: `Noch nichts zum Vorschauen.` + `Push dein Projekt zu GitHub, dann verbinde Vercel zum Deployen…` — DE only, jargon-heavy (`Push`, `pushen`, `Deployen`, `Auto-Deploy`, `Code-Tab`). **[a]**

## 4. First failures a stranger will hit

- `lib/friendly-error.ts` (DE): model unavailable → `Dieses KI-Modell ist gerade nicht verfügbar. Wähle oben ein anderes Modell (z. B. Llama 3.3 70B)…` (L10) — leaks a raw model name to a non-technical user. Missing key, rate-limit, session-expired, network, offline, server-down all mapped to friendly DE copy (L13–45); generic fallback `Etwas ist schiefgelaufen — bitte nochmal versuchen.` **[a]**
- Trial-end gate `app/dashboard/trial-gate/page.tsx`: `Deine Testphase ist beendet` / `Your free trial has ended` + reassurance `Deine Projekte und bereits veröffentlichten Apps bleiben erhalten und online…` (L108). **[a]**
- Quota-hit: upgrade page variant `?reason=limit-hit` → `Mehr Kontingent pro Monat — wenn du gerade an deine Grenze gestoßen bist.` **[a]**
- Build status bar `components/build/build-status-bar.tsx`: fallback labels `Pushing to GitHub` / `Deploying to Vercel` / `Generating project` and `✓ Done` / `✗ Failed` are **hardcoded EN** in a DE app (L11–14, 60–63) — but only shown when the server's `build.message` (usually DE) is absent (L62). **[v]**

## 5. Onboarding flow (does it explain what Goblin is?)

- Fork `app/welcome/page.tsx`: `Kennst du dich mit Vibe Coding aus?` / `Are you familiar with vibe coding?`. "Not yet" → explainer. **[a]**
- Explainer `app/welcome/_components/i18n.ts:164+` **defines** vibe coding: `Du sagst, was du willst. Goblin baut es.` + `Du beschreibst in normalen Sätzen, was du willst — Goblin schreibt daraus echten Code, den du mit einem Klick veröffentlichst. Kein Editor-Wissen nötig.` Three steps: `Beschreib es in normaler Sprache` / `Die KI schreibt den Code` / (step 3 title was `Du shipst` / `You ship`). **[v]** → step-3 jargon **fixed** (commit F3 → `Du bringst es live` / `You go live`).
- In-app tour `components/onboarding/first-run-tour.tsx` (3 steps, bilingual): `Hier leben deine Projekte`; `Vom Chat in den Code` (references `[An Code senden]`); `Behalte deinen Verbrauch im Blick` — surfaces the raw term `BYOK-Key` to a first-run user (L25/42). **[a]**
- `components/onboarding/first-chat-tip.tsx`: hardcoded **DE only**, no EN branch (L56). **[a]**
- `components/onboarding/SoftLimitBanner.tsx`: **inert for cold users** — gated behind `NEXT_PUBLIC_FREE_POOL_ENABLED` and returns null when unset (L52); its trial/quota copy is dead code by design (false-promise guard). **[a]**

## 6. First-user support surface (present)

- `components/help/HelpArticleBody.tsx` (help/FAQ), `components/feedback/FeedbackModal.tsx` (feedback → `0087_feedback`), `components/support/support-chat.tsx` + `support-bubble.tsx`. Server: `0086_support_tickets`, escalation email via `RESEND_API_KEY` → `SUPPORT_EMAIL_TO`. A stuck user has a path (help FAQ + mailto + feedback). Founder must verify the email escalation is live (see checklist). **[a]** / env **[v]**

---

## Cross-cutting observations (evidence, not verdicts)

- **i18n inconsistency:** login (EN), upgrade page (DE), preview-tab (DE), first-chat-tip (DE), EmptyChat (DE), build-status-bar (EN) are single-language hardcoded while the rest of the app is bilingual. → tabled (LAUNCH_DECISIONS D-1).
- **Jargon in first-run surfaces:** `Deploy/deployst`, `Push/pushen`, `Repo`, `token`, `BYOK` appear before definition on several surfaces. Some (Vercel JIT token steps, tour's Send-to-Code) are explained in place; others (`du deployst`, preview `pushen`) are not. → tabled (LAUNCH_DECISIONS D-2).
- **Disabled affordances are honest:** every `Bald`/`Soon` element found is `aria-disabled`/`disabled`, non-focusable — no clickable-but-fake affordance in any first-run surface. No dead `href="#"`. (Mandatory check — holds.)
- **"What's new" → `/help`:** dashboard `Alle Updates →` links to `/help`, a documented stand-in for a real changelog (TODO comment, `app/dashboard/page.tsx:551`). → noted, tabled.
