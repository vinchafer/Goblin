# WALK2_META — Feeling Walk 2 (Evidence Only)

**Status:** HALTED before scenario execution — see `ENV_BLOCKER.md`.
Reason: the in-session headless browser cannot reach production through the
sanctioned egress proxy (browser↔proxy incompatibility, not a policy denial).
No W2 scenario was executed; no product observation was recorded. This file
records only the facts that were verifiable without a browser session.

## Run identity
| Field | Value |
|---|---|
| Wave | FEELING WALK 2 (observation-only evidence collection) |
| Date (session) | 2026-07-10 |
| Repo branch | `claude/feeling-walk-2-evidence-fth9oz` |
| Repo HEAD | `b485cedc2635ff00129d24e658be02eb82498f16` |
| HEAD commit subject | `docs(sprint): FEEL-4 merge report + prod smoke evidence (89591cf) [gates]` |
| Precondition "run AFTER FEEL-4 merge" | ✅ satisfied — FEEL-4 merge (`89591cf`) is in HEAD history |

## Production commit (from `/api/version`)
Captured live via `curl` through the sanctioned proxy (raw artifact:
`raw/api-version.json`):

```json
{"version":"0.0.0","gitCommit":"b485cedc2635ff00129d24e658be02eb82498f16","buildTime":"2026-07-10T03:07:35.279Z","nodeEnv":"production","apiUrl":"https://goblinapi-production.up.railway.app","webReady":true}
```

- **Web git commit:** `b485cedc2635ff00129d24e658be02eb82498f16`
- **API base:** `https://goblinapi-production.up.railway.app`
- **Repo HEAD == production web commit:** ✅ identical (`b485ced…`)
- **API commit:** NOT captured — would require an authenticated `/api/version`
  equivalent on the API host; not reached without a browser/authenticated
  session. (Recorded as a gap, not fabricated.)

## Target & account (intended, per prompt)
| Field | Intended value |
|---|---|
| Walk target | `https://justgoblin.com` → redirects 307 to `https://www.justgoblin.com` |
| Test account | `TEST_ACCOUNT_EMAIL` env (password login via `TEST_ACCOUNT_PASSWORD`) |
| Login path | `loginViaPasswordUI` (tests/e2e/helpers/auth.ts) — only path viable here; Supabase service-role keys are NOT present in this session |
| Viewports | 375 px (mobile) for W2-1, W2-2; default for others |

> Note: the prompt names test account `vinc.hafner3@gmail.com` and "Isolated
> Chrome :9222". The cloud header overrides both: use `TEST_ACCOUNT_EMAIL` /
> `TEST_ACCOUNT_PASSWORD` env creds and an in-session Playwright/Chromium.
> Secret values were never printed or logged.

## Environment
| Field | Value |
|---|---|
| Chromium | 141.0.7390.37 (pre-installed, `/opt/pw-browsers/chromium-1194`) |
| Node | v22.22.2 |
| Driver | playwright-core 1.49.1 (scratchpad-local) |
| Egress | all HTTPS via sanctioned CONNECT proxy `HTTPS_PROXY` (127.0.0.1:40875) |
| Supabase keys | absent (NEXT_PUBLIC_SUPABASE_URL / SERVICE_ROLE_KEY / ANON unset) |

## Artifacts in this bundle
- `ENV_BLOCKER.md` — full, reproducible account of the browser-egress blocker.
- `OBSERVATIONS.md` — W2-1…W2-8, each marked NOT EXECUTED (no fabricated data).
- `TIMINGS.md`, `TRANSCRIPTS.md` — empty by necessity (no session occurred).
- `screenshots/` — empty (no page ever rendered).
- `raw/api-version.json` — live production version payload.
- `raw/proxy-control-proofs.txt` — curl/proxy reaches prod (HTTP 200).
- `raw/chrome-netlog-errors.txt` — headless-Chromium net-log error tallies.
- `raw/chrome-ssl-handshake-errors.txt` — Chromium SSL handshake reset tally.
- `raw/proxy-status-snapshot.json` — sanctioned-proxy status + failure log.
