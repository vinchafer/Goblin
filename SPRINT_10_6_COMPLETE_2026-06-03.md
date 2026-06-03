# Sprint 10.6 — COMPLETE

Date: 2026-06-03 · Branch: master · Start HEAD: 9998d1c

## 1. Headline — 🟢 GREEN (code), 🟡 founder live-verify pending

All 5 items shipped as atomic commits. typecheck (web + api + shared) and the full
production build pass. The two real Max-walk blockers (GitHub Connect not sticking;
Send-to-Code producing one invalid glued file) are root-caused and fixed in code.
Live proof for the cross-origin OAuth redirect and the real Vercel deploy URL is by
code-path + Railway logging — the founder's iPhone Max-walk is the final sign-off.

## 2. Per-item status

| Item | Status | Commit |
|------|--------|--------|
| 10.6-1 GitHub OAuth token persistence + redirect | ✅ root-caused + fixed | 230ef85 |
| 10.6-2 Send-to-Code multi-block file splitting | ✅ fixed + fixture 6/6 | 24f3059 |
| 10.6-3 Vercel canonical URL | ✅ real gap found + fixed | e9e6f68 |
| 10.6-4 Send-to-Code without project | ✅ bug found + fixed | 47aec63 |
| 10.6-5 Vercel ownership UX | ✅ 3 touches shipped | 47c631d |

### 10.6-1 — GitHub OAuth
ROOT CAUSE (the visible blocker): the active Settings panel `ConnectorsPage` fetched
`/api/connectors/status`, **which is mounted nowhere** → 404 → GitHub always rendered
"Verbinden" even when the token persisted. Pointed it at the real `/api/github/status`.
Also: "Verbinden" bounced to a legacy page that ignored the param (double-click) and
the connect call sent no `returnTo` → landed on `/dashboard`. Now one-click OAuth with
`returnTo` back to Settings; legacy button also passes `returnTo`; callback logs each
step. The OAuth flow is already Strategy-A (server-side `oauth_states` state→userId).
"Lands on login" prime suspect = Railway `NEXT_PUBLIC_APP_URL` ≠ the login-cookie
domain (founder env). Trace: `sprint-10-6/oauth-investigation.md`.

### 10.6-2 — Send-to-Code multi-file
"Send All N blocks" glued every block into one buffer with `// File:` comment
separators → a single invalid file, no `index.html` at root → Vercel 404. New
`blocksToFiles()` splits into clean `{path, content}[]`: first HTML → `index.html`,
CSS/JS adopt the names the HTML `<link>`s/`<script src>`s (so the deployed page loads
its assets), explicit `// File:` markers honored + stripped, dupes de-duped. Wired
through both the multi-session path (seeds one session with all files as drafts) and
the classic path. Single-block behavior unchanged. Fixture test: 6/6 pass.

### 10.6-3 — Vercel canonical URL
`deployToVercel` returns at **creation** time, before Vercel assigns the production
alias, so it emitted the build-hash URL (which can 404 while building) and the B-S5
alias logic in `getDeployStatus` was never reached on the main path. Now polls
`getDeployStatus` inside the SSE stream until READY and emits the canonical
`<project>.vercel.app` alias. Trace: `sprint-10-6/vercel-url-trace.md`.

### 10.6-4 — Send-to-Code without project
Found broken: the "create new project" branch navigated to the project **hub**
(`/dashboard/project/<id>`, defaults to Chat, never mounts `CodeWorkspace`), so the
stashed code was never consumed. New `pendingStcTab()` helper deep-links to
`/work?tab=code` when `goblin:stc-pending` exists; applied to all create paths.
Evidence: `sprint-10-6/stc-no-project/VERIFY.md`.

### 10.6-5 — Vercel ownership UX
Three touches: onboarding Step 5 (rewritten Vercel card + full-width ownership
callout with a free-signup link), the deploy moment (no-token explainer modal in the
classic tab, marker-stripped guidance toast in the multi-session tab, ownership line
in the publish-confirm modal), and Settings → Konnektoren → Vercel (always-visible
italic note). Backend no-token error rewritten. Evidence:
`sprint-10-6/vercel-ownership/VERIFY.md`.

## 3. Self-test results
- `@goblin/web` typecheck — PASS
- `@goblin/api` tsc --noEmit — PASS
- `@goblin/shared` build (tsc) — PASS
- `@goblin/api` build (tsup) — PASS
- `@goblin/web` production build — PASS (all routes compiled, exit 0)
- `blocksToFiles` fixture — 6/6 PASS
- Sprint 10 / 10.5 features — not modified destructively (changes are additive:
  one dead-endpoint fix, one multi-file branch, deploy polling, nav suffix, copy).
  No regression expected; founder walk confirms.

## 4. Commits
6 commits, range `9998d1c..47c631d`:
- 230ef85 fix(github): Settings reflects connected state + one-click connect
- 24f3059 fix(stc): split multi-block AI output into separate files
- e9e6f68 fix(vercel): poll until READY to surface the canonical production alias
- 47aec63 fix(stc): deliver project-less code to the Code tab on new-project create
- 47c631d feat(vercel-ux): make 'bring your own Vercel' ownership unmissable
- (+ WIP/report doc commits)

No manual pushes (post-commit hook auto-pushes).

## 5. Founder action list
1. **No new migrations** in 10.6 — verified. Nothing to apply.
2. **GitHub OAuth (10.6-1)** — after deploy: confirm Railway `NEXT_PUBLIC_APP_URL`
   equals the canonical login domain (prime suspect for the login bounce). Then
   disconnect any existing GitHub link and re-connect. Settings → Konnektoren should
   show "@username". Watch Railway for `github_callback {stateValid,tokenExchanged,
   saved}` log lines.
3. **Vercel URL (10.6-3)** — deploy a multi-file project; Railway `[vercel] deployment
   status` lines should reach `state: READY` with a non-null alias; "Öffnen" → 200.
4. **Walk Max on iPhone** — the real validation: signup → onboarding → project →
   Send-to-Code multi-block → separate files → publish → live URL, with the Vercel
   ownership messaging visible.

## 6. Open / deferred
- Local CDP walks (10.6-4 live, 10.6-5 visual, Phase-F walk) could not run: no Chrome
  with `--remote-debugging-port=9222` on this machine (`browser-harness`:
  "DevToolsActivePort not found"). All deferred to the founder Max-walk; each item has
  a founder live-verify checklist in its `sprint-10-6/*` doc.
- 10.6-1 login bounce: if it persists after the `NEXT_PUBLIC_APP_URL` check, it is a
  cookie-domain issue worth a focused Sprint 10.7 (SameSite/Domain on the Supabase
  session cookie) — not attempted here to avoid auth regressions.

## 7. Bartlett self-assessment
- Each item root-caused, not patched: 10.6-1 was a dead endpoint (not token logic),
  10.6-3 was a never-polled status (not the alias formula), 10.6-4 was a hub-vs-work
  nav mismatch. 10.6-2 fixed the `// File:` pattern at its single source.
- Back-compat preserved (single-block send unchanged; OAuth flow untouched at the
  protocol level). Additive changes only.
- Honest about what is code-verified vs. founder-verified. No green-on-green claims.
- Gap to 10/10: no live browser proof this session (environment, not effort).

## 8. Beta-readiness verdict
The two hard blockers are gone in code. With the founder's `NEXT_PUBLIC_APP_URL`
check + a single iPhone Max-walk, the prompt→live-URL loop should complete end-to-end
with clear Vercel ownership. Beta-ready pending that one walk.
