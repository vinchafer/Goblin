# WALK3 — DONE (close the deploy loop + files/activity redesign)

Date: 2026-06-10 · prod justgoblin.com · vinc.hafner3 (greeting confirmed, never
personal) · CDP, mobile 390 + desktop/split widths. Build: api `tsc` clean, api
vitest **78 passed**, web `next build` PASS. Guards: loop untouched; no invented
data; Groq default; commits WALK3-; origin/master == HEAD; design v1.1.

Verification scope (the recurring lesson): diagnoses are proven on **confirmed-
current** prod. The WALK3 code fixes are NOT yet deployed (prod = e3fd747), so fixed
behaviour is proven locally (build + tests); each item marks what is founder-verified.

---

## PHASE 0 — deploy hygiene — **GREEN (prod confirmed current)**
Both version endpoints report the live GitHub HEAD:
- web (Vercel): `GET https://www.justgoblin.com/api/version` → `gitCommit e3fd7472…`.
- api (Railway): `GET https://goblinapi-production.up.railway.app/version` → `gitCommit e3fd7472…`.
The founder's `c3891f62` is Railway's internal deploy ID, not the git SHA. Prod is
current → Phase 1+ debugged against real code, not ghosts. (Note: the API version
route is `/version`, not `/api/version`.)

## PHASE 1 (critical path) — GitHub connect — **diagnosed on prod; root cause is a Railway secret**
Reproduced on current prod (mobile 390, vinc.hafner3): Konnektoren → **Verbinden** →
browser lands on `goblin-web.vercel.app/dashboard?error=github_failed#connectors`
(02-github-error.png). This IS the founder's "reopens settings".

Trace (real bytes): `error=github_failed` is emitted ONLY by the OAuth **callback**
catch (`github.ts:137`) — and only AFTER a valid `oauth_states` lookup. So OAuth
**does start and round-trips** (connect → github.com → callback with code+state); it
then throws in the callback. By elimination: `saveGitHubConnection` never throws (no
error check), `encryptData` works on prod (BYOK/Vercel keys decrypt fine), client_id
is valid + redirect_uri matched (GitHub issued a code) → the throw is
**`exchangeCodeForToken`**: GitHub rejects the token exchange = `GITHUB_CLIENT_SECRET_RAILWAY`
wrong/missing on Railway.

Code fixes (this PR):
- `github-oauth.ts`: accept `GITHUB_CLIENT_*` as a fallback to `*_RAILWAY` (fixes a
  name-mismatch outright); throw a typed `GitHubOAuthError` carrying GitHub's machine
  code; `exchangeCodeForToken` fails fast with `missing_server_credentials` when no
  secret; `getUsername` throws on empty login + sends UA/Accept headers.
- `github.ts` callback: redirect now carries `&reason=<code>` and logs it.
- `dashboard-shell.tsx`: the OAuth return is now legible — a success toast
  ("GitHub verbunden ✓") or an actionable failure ("…fehlgeschlagen: Falsches GitHub
  Client-Secret (Railway-Env)") instead of a silent settings re-open.

Verdict: **OAuth starts — PROVEN on prod** (round-trips to GitHub + callback runs).
**Returns "Verbunden" — AMBER**: blocked on a Railway env the agent cannot set.
FOUNDER ACTION (closes the P0 publish path):
  1. Railway → set `GITHUB_CLIENT_SECRET_RAILWAY` to the GitHub OAuth App's current
     secret (regenerate in GitHub if unsure), and `GITHUB_CLIENT_ID_RAILWAY` matches.
  2. Set `NEXT_PUBLIC_APP_URL=https://www.justgoblin.com` on Railway (today it's
     `goblin-web.vercel.app`, so the OAuth return bounces to the wrong origin).
  3. Redeploy, tap Verbinden once — the new `reason=` param + toast will name the
     exact cause if anything still fails. (Railway logs already log `reason` now.)

## PHASE 2 — split-screen model picker → icon — **re-fixed (root caused why WALK2 missed)**
WALK2 put the container query on `SessionPromptInput` (`gb-composer`) — but the
composer the founder sees in split/constrained is the SessionPane **`gb-editor-ask`**
bar (shown ≤860px; >860 uses the threaded composer). Proven on prod: at 820px the
visible picker is `gb-editor-ask`'s, sitting alone on a full row (03-picker-fullrow-
before.png). Fix: that composer only renders constrained, so the picker now sits as an
**icon next to Send** (`SessionPromptInput`/`SessionModelPicker` `variant="icon"`,
dropdown anchored right); the wasteful own-row is gone. Full-screen (>860px) is
untouched (threaded composer, labelled picker). Founder check: split = icon, full = label.

## PHASE 3 — Files overview — **3.1 + 3.2 + 3.3 (with one scoped proposal)**
- **3.1 (prominence swap)** — project overview: "Explorer öffnen" is now the
  primary/large button; "Editor öffnen →" is the small top-right link. (page.tsx)
- **3.2 (per-file ⋮ menu)** — `FileExplorer.tsx`: the 3 fixed icons are replaced by a
  ⋮ overflow menu: Im Editor öffnen · Kopieren (content→clipboard) · Teilen
  (native share / clipboard) · Umbenennen · Verschieben · Download · Löschen (delete
  still behind the existing confirm). "Im Editor öffnen" links `?file=<path>` (editor
  isolation is best-effort until the editor reads that param — noted).
  **PROPOSAL (not shipped):** "Verschieben **in ein anderes Projekt**" needs a new
  cross-project storage endpoint (`copy to project B + delete from A`) + a project
  picker. It does NOT touch the publish loop, but it's a new API + UI surface — shipping
  it half-built would be worse than proposing. In-project move (edit path) ships now.
- **3.3 (columns)** — added a sticky column header (Name · Grösse · Bearbeitet).
  **Honest gap:** S3 exposes only size + last-modified per object — "Erstellt" and
  "Zuletzt committed/gepusht" aren't tracked per file, so they're NOT faked. Adding
  them needs a per-file DB index (created_at + last push) — proposal.
Verify: explorer at 390 + desktop (founder).

## PHASE 4 — Activity feed — **wired to real events; CTA fixed**
The card was empty because it read `chat_messages` (legacy, empty for new-chat
projects) + `build_runs` (empty — deploys live in `deployments`). Rebuilt from real DB
rows: `deployments` (publishes) + `code_sessions` + `chat_sessions` (+ legacy messages
if any), newest first, top 8 — nothing fabricated. The mismatched "Chat öffnen" header
CTA is replaced by a neutral "ZULETZT" label (chat is reached from the header/sessions
card; no fake history page invented). Founder check: card shows real recent events.

---

## FOUNDER CHECKLIST
1. Both /api/version current — ✅ confirmed (Phase 0).
2. GitHub connect → after the Railway secret fix → OAuth → Verbunden.
3. Then the P0 live proof: fresh project → edit → Veröffentlichen → open live URL = change.
4. Split-screen: model picker is an icon next to Send.
5. Files: Explorer primary, ⋮ menu, column headers.
6. Aktivität shows real events.

## Files touched
- api: `services/github-oauth.ts`, `routes/github.ts`
- web: `components/app-shell/dashboard-shell.tsx`, `components/code/SessionPane.tsx`,
  `components/code/SessionModelPicker.tsx`, `components/files/FileExplorer.tsx`,
  `app/dashboard/project/[id]/page.tsx`
