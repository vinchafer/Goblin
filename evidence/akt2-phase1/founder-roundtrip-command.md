# U1.5 — BLOCKED-ON-FOUNDER: the exact commands for the real-API round-trip

**Status: the U1.5 gate is NOT green. It is blocked, honestly, and this file is what unblocks it.**

## Why it is blocked (measured, not assumed)

The round-trip must run against the real Cloudflare APIs **from the deployed Railway code path** —
never from a CC sandbox holding raw tokens (Rule 4; `OPS_SPIKE_0_DECISION_TABLE.md` §4.4). The
endpoint that performs it (`POST /api/ops/selftest`) exists in this PR, but production is not running
this PR:

```
$ curl -s https://goblinapi-production.up.railway.app/api/version
{"version":"0.2.0","gitCommit":"a009bbd2bbef4d8b0ff693af9614cc0a3f6f52c5", … }
```

`a009bbd` is `origin/master` — the commit this branch was cut from. Railway deploys master, not PR
branches, so **the self-test endpoint cannot exist on a running server until this PR is merged.**
There is no way to close this gate inside this session that does not involve a token in the sandbox,
which is forbidden. So: merge first, then run the four steps below.

Full probe output: `cohort-invisibility-probe.txt` in this folder.

---

## What you need (all four are things you already have)

| # | Value | Where it is | Secret? |
|---|---|---|---|
| 1 | `API` = `https://goblinapi-production.up.railway.app` | already below | no |
| 2 | `SUPABASE_URL` | Railway → `NEXT_PUBLIC_SUPABASE_URL`, or Supabase dashboard → Project Settings → API | no (it is in the public web bundle) |
| 3 | `SUPABASE_ANON_KEY` | same place — the **anon/publishable** key, **not** the service-role key | no (public by design) |
| 4 | The password for **vinc.hafner3@gmail.com** | your password manager | **yes — never paste it anywhere but the command** |

> **Do not paste the access token, the anon key, the password, or any Cloudflare value into chat.**
> The two outputs you *are* asked to paste (health, self-test) are built to contain no secret value:
> env vars are reported by name with a boolean, and every upstream message is scrubbed of secret
> values before it can reach the response. That is tested (`ops-health.test.ts`), not hoped.

---

## Step 1 — turn the switch on, briefly

Railway → API service → Variables:

```
OPS_HOSTING_ENABLED = true
```

(Confirm `OPS_BETA_ACCOUNTS` is `vinc.hafner3@gmail.com`.) Wait for the redeploy to finish.

**This is the only window in which any Act-2 route exists at all.** It is a few minutes long, and
nothing in the product links to these routes, so a real user cannot stumble into them. Step 4 closes
it again. If you get interrupted between step 1 and step 4, set the flag back to `false` — nothing
else needs undoing.

## Step 2 — get an access token for the test account

Paste this whole block into a terminal (iPhone: a-Shell/iSH; laptop: any terminal). Fill in the three
values on the first three lines.

```bash
API=https://goblinapi-production.up.railway.app
SUPABASE_URL=https://YOUR-PROJECT.supabase.co     # ← from Railway / Supabase dashboard
SUPABASE_ANON_KEY=eyJ...                          # ← the ANON key, not service_role
EMAIL=vinc.hafner3@gmail.com

read -r -s -p "Passwort fuer $EMAIL: " PW; echo

TOKEN=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "content-type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}" \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')

[ -n "$TOKEN" ] && echo "token ok (${#TOKEN} chars)" || echo "LOGIN FAILED — check URL/anon key/password"
```

It prints only a length, never the token.

## Step 3 — run the two commands, paste both outputs

**3a — health probe (read-only, safe to run any number of times):**

```bash
curl -s "$API/api/ops/health" -H "Authorization: Bearer $TOKEN"
```

Expected shape — `status` should be `ok`, and all four checks `ok`:

```json
{"status":"ok","hostingEnabled":true,"appsDomain":"justgoblin.app",
 "checks":{"env":{"status":"ok","missing":[]},
           "r2":{"status":"ok","latencyMs":…,"bucket":"goblin-apps"},
           "kv":{"status":"ok","latencyMs":…},
           "workers":{"status":"ok","latencyMs":…,"scriptCount":…}}, …}
```

*If a check says `fail` with `"code":"auth"`, the Cloudflare token is missing that scope — that is
exactly what this probe exists to find out before Phase 2 needs it. Paste it anyway; a red probe is a
useful result, not a failed run.*

**3b — the round-trip self-test** (writes to and deletes from the real substrate, inside the fixed
scope `apps/test-roundtrip/`, KV key `route:test-roundtrip`, worker `goblin-ops-selftest` — it takes
no target parameter and cannot be pointed at a real app):

```bash
curl -s -X POST "$API/api/ops/selftest" -H "Authorization: Bearer $TOKEN"
```

Expected on success: `"passed":true` and `"summary":"r2 3/3 · kv 3/3 · workers 3/3"`.

It runs each round-trip **three times**: R2 (put 3 files → list 3/3 → get each and byte-match →
batched delete → list 0), KV (setRoute → getRoute matches → deleteRoute → gone), Workers (deploy a
hello script → read back → delete → gone). Every step is reported with a number, and cleanup runs
even when a step fails — if cleanup fails, `passed` is `false` even though every run passed, because
a self-test that leaves debris behind and calls itself green is worse than no self-test.

To run it once instead of three times: `…/api/ops/selftest?runs=1`.

## Step 4 — turn the switch back off

Railway → API service → Variables:

```
OPS_HOSTING_ENABLED = false
```

Wait for the redeploy, then confirm the plane is dark again — this must print `404 Not Found`:

```bash
curl -s "$API/api/ops/health" -H "Authorization: Bearer $TOKEN"
```

## Step 5 — send both outputs to Steven

Paste the two JSON blobs from step 3 (and the 404 from step 4). They belong in
`evidence/akt2-phase1/` as the U1.5 artifact; until they exist, **U1.5 stays BLOCKED-ON-FOUNDER and
must not be reported as green.**

---

## If something fails

| Symptom | What it means | What to do |
|---|---|---|
| `404 Not Found` on `/api/ops/health` with a good token | `OPS_HOSTING_ENABLED` is not `true`, or the redeploy has not finished, or the email is not in `OPS_BETA_ACCOUNTS` | re-check step 1 (the value must be exactly `true`) |
| `LOGIN FAILED` | wrong Supabase URL / anon key / password | re-check the three values in step 2 |
| a check reads `"status":"skip","reason":"missing_env"` | that Railway variable is not set at all | set it; `skip` means "not configured", `fail` means "configured but the call did not work" |
| `"code":"auth"` on `workers` | the CF token lacks **Account · Workers Scripts** | add the scope in the Cloudflare dashboard and re-run 3a |
| `"code":"not_found"` on `kv` | `CF_KV_NAMESPACE_ID` points at a namespace that does not exist | re-check the id in the Cloudflare dashboard |
| `"passed":false` but every run `3/3` | cleanup failed — something is left behind in R2/KV/Workers | paste the output; the `cleanedUp` fields say which surface |
