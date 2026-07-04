# Hygiene Sprint — Telemetry Week (2026-07-05)

Branch `hygiene-2026-07-05` (from master `48dc980`) → merged `--no-ff` into master.

**Merge SHA: `216b2057838707fd2b9186877607adc1b36f7e33`** (short `216b205`)

Absolute constraint honored: **zero consumption-path changes.** All work is
storage / copy / routing / deletion. No prompts, model-router, context injection,
history windows, summarizer, or any model-call path was touched.

---

## H1 — DSGVO deletion purge (High)

**Defect:** user hard-delete purged only `users/<id>/` in B2; each project's files
under `projects/<projectId>/` (incl. `.trash/`) were orphaned forever after the DB
rows cascaded away. GDPR Art. 17 gap.

**Fix:** `hardDeleteUser` now enumerates the user's projects **before** the auth
cascade and purges every `projects/<id>/` prefix via a new `purgeProjectStorage()`
(file-storage.ts). Idempotent + resumable: 1000-object batched delete, then
re-lists each prefix to **verify empty**; collects (never throws) per-project
failures; on any partial failure `hardDeleteUser` throws, leaving
`account_deletions.status = 'pending'` so the cron re-runs and re-purges. Purge sits
at grace-period expiry (existing 10-day soft-delete semantics), which is where
`deleteUserStorage` already ran.

**Gate H1 — PASS.** Integration test against **real Backblaze B2** with throwaway
UUID prefixes (no real account touched): seeded `users/<x>/` + two `projects/<p>/`
incl. `.trash/` → ran deletion ops → both prefixes verified empty; idempotent
re-run clean. Evidence: `H1_purge_capture.txt`. Deterministic wiring also asserted
in `account-deletion.test.ts` PROOF 4 (`purgeProjectStorage` called with the user's
project ids). Full API suite: **333 passed**.

Commit `4a7f865` — `fix(privacy): purge project storage on user deletion [H1]`

## H2 — Onboarding copy (Max persona, DE + EN)

1. **Unverifiable time claims removed** across the flow: free-key subtitle
   (`~60 Sek`/`~60 sec` → "du brauchst nur ein Google-Konto" / "all you need is a
   Google account"), provider price tags (`~60 SEK/SEC` dropped), summary eyebrow
   (`5 MIN INSGESAMT`/`5 MIN TOTAL` dropped), GitHub note (`in under a minute`
   dropped), and the Discord sample (`deployed in 28s` dropped).
2. **"Commit" jargon** replaced in user-facing onboarding copy — shipNote,
   githubDesc, and the login value bullet → "gespeicherter Stand" / "saved version".
   The Code workspace's developer Git surfaces (`SessionGitPill` etc.) were left
   **untouched** (verified: still contain "Commit").
3. **Vibe-coding explainer (NO branch)** now leads with a concrete mechanism
   sentence ("Du beschreibst in normalen Sätzen … Kein Editor-Wissen nötig." / EN),
   no new screen, within the existing length budget.

**Gate H2 — PASS.** Old strings absent / new strings present in the built client
bundles + source (`H2_strings.txt`, OVERALL PASS). Rendered **DE + EN at a real
375px mobile viewport** for all four changed welcome screens (`H2_*.png`, 8 files).

Commit `6b71d04` — `fix(onboarding): honest copy for Max persona [H2]`

## H3 — `/de` 404

**Diagnosis:** App Router, no i18n routing, no `[locale]` segment, no locale
middleware — `/de` was never a route. The marketing landing is served
language-neutral at `/` (client toggles DE/EN), so there is no distinct German
canonical page. **Fix:** one redirect in `next.config.ts` — `/de → /` (permanent),
firing before auth middleware (no `/login` bounce). `/en` and `/` untouched.

**Gate H3 — PASS.** Local: `/de → 308 → / → 200`; `/` unchanged 200.
Evidence: `H3_de_route.txt`. (Next emits 308 for `permanent: true` — the
permanent-redirect equivalent of 301; one-line switch to literal 301 if required.)

Commit `e186b0a` — `fix(web): german landing route [H3]`

---

## Final checks (all green)

- **API suite:** 333 passed (32 files).
- **tsc --noEmit:** clean for api **and** web.
- **Evidence files present:** `H1_purge_capture.txt`, `H2_strings.txt` + 8 `H2_*.png`, `H3_de_route.txt`.
- **Consumption purity — diffstat proof** (`git diff master..HEAD --stat`), code files only:
  - `apps/api/src/services/file-storage.ts` (B2 storage)
  - `apps/api/src/services/account-deletion.ts` (GDPR deletion)
  - `apps/api/src/services/account-deletion.test.ts`
  - `apps/api/scripts/h1-purge-integration.mts`
  - `apps/web/app/welcome/_components/i18n.ts` (copy)
  - `apps/web/app/welcome/integrations/page.tsx` (copy)
  - `apps/web/app/(auth)/login/page.tsx` (copy)
  - `apps/web/next.config.ts` (routing)
  - **None** under prompts/, model-router, project-context/state, or chat model paths.

## Merge + production verification

- Rebase onto `origin/master`: no-op (origin unmoved at `48dc980`, history linear).
- `git merge --no-ff` → `216b205`; pushed `48dc980..216b205 master -> master`.
- **Both `/api/version` report the merge commit** `216b2057`:
  - Web (Vercel) `www.justgoblin.com/api/version` → `216b2057`
  - API (Railway) `goblinapi-production.up.railway.app/api/version` → `216b2057`
- **Prod `/de`:** `www.justgoblin.com/de → 308 → / → 200` (apex adds a `307 → www`
  canonicalization first); `/` unchanged 200. **No longer 404.**
- **Prod onboarding copy:** `www.justgoblin.com/welcome/explainer` is deployed
  (307 → /login, not 404). The deployed build IS merge SHA `216b2057`, whose bundle
  was grep-verified to carry the new copy and none of the old (H2_strings.txt), and
  the 8 `H2_*.png` at 375px render that exact code DE+EN. A literal *logged-in* prod
  screenshot was **not** forced: prod `/login` uses the PKCE code-flow, so an
  admin-minted implicit-hash magic link does not self-login, and forcing it would
  have meant a browser rabbit-hole. The copy is verified transitively to high
  confidence; happy to capture a logged-in prod shot if you want it.

## Notes / follow-ups (out of scope, flagged)

- `next.config` `/de` redirect is **308** (Next's permanent). Switch to
  `statusCode: 301` if a literal 301 is mandated.
- Pre-existing (not touched): `sitemap.ts` uses the wrong domain `goblin.build`
  (should be `justgoblin.com`); no `hreflang` alternates; `deleteProject()` in
  file-storage.ts sends `DeleteObjects` unbatched (>1000-file projects would fail) —
  H1's new `purgeProjectStorage()` avoids this by batching, but the older
  `deleteProject` path still has it.
