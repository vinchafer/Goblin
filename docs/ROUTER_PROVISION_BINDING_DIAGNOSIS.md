# Router provisioning — why the binding was empty at upload time

**2026-08-10 · diagnosis first, fix at the confirmed cause.**

The symptom, from `POST /api/ops/router/provision` on production:

```
worker: "binding APPS has no value — CF_KV_NAMESPACE_ID / CF_R2_BUCKET missing"
route:  "10019 Cannot configure a route for a Worker which does not exist"
```

zone ok, dns ok (`*.justgoblin.app` proxied). The token carries every scope the
run needs. The bucket `goblin-apps` exists in the EU jurisdiction. The founder
reports both variables as set in Railway.

---

## The answer, in one line

**`CF_R2_BUCKET` is empty or unset in the running API process — and only that one.
`CF_KV_NAMESPACE_ID` is fine.** The message said otherwise, and that was a defect
in the message, not in the founder's reading of it.

---

## 1. Which names the upload path reads

`apps/api/src/services/ops-router-deploy.ts:116-123` (before this change) is the
only place the router's bindings are assembled:

```ts
{ type: 'kv_namespace', name: 'ROUTES', namespace_id: (process.env.CF_KV_NAMESPACE_ID ?? '').trim() },
{ type: 'r2_bucket',    name: 'APPS',   bucket_name:  (process.env.CF_R2_BUCKET ?? '').trim() },
```

Compared character by character against every other occurrence in the repository:

| Location | Name | Verdict |
|---|---|---|
| `services/cf-deploy.ts:209-210` (`CF_ENV_VARS`) | `CF_R2_BUCKET`, `CF_KV_NAMESPACE_ID` | identical |
| `routes/ops.ts:86,94` (health probe) | both | identical |
| `docs/GOBLIN_CONSUMPTION_LEDGER.md:304` | both | identical |
| `docs/GOBLIN_OPS_MASTER_PLAN_16_PHASES.md:161` | `CF_R2_*`, `CF_KV_NAMESPACE_ID` | identical |
| `evidence/akt2-phase1/roundtrip-local-2026-07-28.txt:2` | both | identical |
| `evidence/akt2-phase1/founder-roundtrip-command.md:151` | `CF_KV_NAMESPACE_ID` | identical |
| `docs/AKT2_PHASE2_FOUNDER_WINDOW.md` | — | **never mentioned them at all** |

**There is no name mismatch.** The prime suspect is cleared: the code and every
document that names these variables agree on the spelling.

What the sweep did turn up instead is an absence. `docs/ENV_REFERENCE.md` — the
file whose own first line calls it "the single source of truth" — delegates the
Act-2 variables away at line 104:

> ops/Act-2 (`OPS_*`, `CF_*`) … is documented inline, with defaults and links, in
> **`apps/api/.env.example`**.

`apps/api/.env.example` contained **no `CF_*` variable and no `OPS_*` variable**.
Both required names were documented nowhere a founder could check a spelling
against. That is the condition under which "he reports them as set" and "the
process says empty" can both be true and stay unresolved.

**Fixed:** `apps/api/.env.example` now carries the full Act-2 block — every name
the code reads, where each value comes from, and which dashboard field it is
copied out of.

## 2. Hardened reader, or raw?

Raw. PR #77 (`6bdc898`) added `lib/env-value.ts` and converted 17 parsers across
11 files; its diffstat touches neither `ops-router-deploy.ts` nor `cf-deploy.ts`.
Both read `process.env` with a bare `.trim()`:

- `ops-router-deploy.ts:118-119` — the two bindings
- `cf-deploy.ts:245-247` — `env()`, used for every credential and identifier
- also `timeoutMs()`, `workerCompatDate()`, `opsSiteUrl()`

**Would a quoted value produce exactly this error? No — and that matters.**
`CF_R2_BUCKET="goblin-apps"` survives `.trim()` as `"goblin-apps"` *with the
quotes*, which is a string of length 13. It is not empty, so it never reaches the
"has no value" branch. It gets uploaded to Cloudflare as a bucket named
`"goblin-apps"`, quotes included, and fails at the API with a message about a
bucket nobody created — a *different* symptom, further from the paste.

So a quoted paste is ruled out as the cause of this particular error. Only three
states reach it: unset, empty, or whitespace-only.

**Hardened anyway**, because the quoted case is the strictly worse failure and
was one paste away: both files now read through `unwrapEnv`. Consistency is the
point — hardening only the binding assembly would let a quoted `CF_R2_BUCKET`
bind correctly in the Worker while the API's own R2 writes addressed a
differently-named bucket.

## 3. Is the multipart metadata shaped correctly?

Yes. Verified against the live Cloudflare docs on 2026-08-10 (page last updated
2026-07-03), not from memory:

[Multipart upload metadata](https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/)

| Doc says | `cf-deploy.ts:888-901` sends | |
|---|---|---|
| `main_module` (required) — "the part name that contains the module entry point" | `main_module: 'worker.mjs'`, and the file part is appended under that same name | ✔ |
| `compatibility_date` (optional, "highly recommended … otherwise defaults to 2021-11-02") | always set; fixed default `2025-01-01` | ✔ |
| `bindings` array (optional) | sent on every upload | ✔ |
| `{"type":"kv_namespace","name":…,"namespace_id":…}` | exactly those three keys | ✔ |
| `{"type":"r2_bucket","name":…,"bucket_name":…}` | exactly those three keys | ✔ |
| `{"type":"plain_text","name":…,"text":…}` | exactly those three keys | ✔ |

The `metadata` part is sent as a `Blob` with `application/json`, the module part
as `application/javascript+module` — both correct for an ES-module Worker.

**No defect here. One flagged risk, deliberately not "fixed" blind:** the bucket
is in the **EU jurisdiction**. Cloudflare's
[R2 data location](https://developers.cloudflare.com/r2/reference/data-location/)
docs state that a bucket in a jurisdiction needs `jurisdiction` on its binding
(`{ binding, bucket_name, jurisdiction: "eu" }`) and must be reached over
`https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com` from the S3 API. The multipart
metadata reference does **not** list a `jurisdiction` field for `r2_bucket`, so
the two pages disagree and nothing here can be settled without the live account.

This is therefore recorded as a **prediction, not a claim**: once `CF_R2_BUCKET`
is set and the upload proceeds, the `APPS` binding may resolve to nothing, or the
upload may reject the bucket outright. If it does, the fix is a `jurisdiction`
field on the binding — and `CF_R2_ENDPOINT` must already carry the `.eu.` host
for the API's own R2 calls. Guessing at it now would mean shipping an untested
field to fix a failure that has not happened.

## 4. Does the message name the variable that is actually missing?

**No. It named both, unconditionally — and that is the diagnosability defect.**

`ops-router-deploy.ts:156-162` found the first empty binding and then discarded
what it had found:

```ts
const missingBinding = bindings.find(…);
step('worker', 'skip', `binding ${missingBinding.name} has no value — CF_KV_NAMESPACE_ID / CF_R2_BUCKET missing`)
```

`missingBinding.name` is interpolated; the variable names are a constant string.
The report therefore *knew* it was `APPS` — the R2 binding — and still sent the
founder to re-check a KV namespace id that had been correct the whole time.

Two further consequences of the same line:

- **`find` stops at the first.** With both empty, the founder fixes one, re-runs,
  and meets the second as a fresh surprise.
- **The skip step carried no `founderAction` at all.** Every other failure branch
  attaches one, and `console-client.tsx:648-656` renders them verbatim. This
  branch rendered a red step with nothing to do about it.

**Fixed.** The refusal now reads:

```
binding APPS has no value — CF_R2_BUCKET is empty or unset in this API's environment
```

with a `founderAction` that names the Railway field, says where a correct value
is copied from (the bucket's *name*, not its id or its S3 URL), lists the three
ways a variable looks set and is not, and points at
`GET /api/ops/health → checks.env.missing` — the arbiter when the dashboard and
the process disagree, which reports presence by name and never a value.

## The route error was never a second problem

`10019 Cannot configure a route for a Worker which does not exist` is downstream
of step 1: the script was never uploaded, so there is nothing to bind a route to.
It needs no separate action and will clear itself once the worker step is green.
The troubleshooting table in `AKT2_PHASE2_FOUNDER_WINDOW.md` §7 now says so.

---

## What the founder has to do

Set **`CF_R2_BUCKET`** on the Goblin **API** service in Railway to the bucket's
name — `goblin-apps`. Nothing else in this report is a founder action, and no
code change can substitute for it.

Confirm it landed before re-running the provision:

```bash
curl -s "$API/api/ops/health" -H "Authorization: Bearer $TOKEN" | jq '.checks.env.missing'
```

An empty array means the running process can see every variable. Then:

```bash
curl -s -X POST "$API/api/ops/router/provision" -H "Authorization: Bearer $TOKEN" | jq
```

## Changed

| File | Why |
|---|---|
| `apps/api/src/services/ops-router-deploy.ts` | names the empty variable, reports all empty bindings, attaches the `founderAction`, reads via `envString`, adds R2 Storage:Edit to the token list |
| `apps/api/src/services/cf-deploy.ts` | `env()`, `timeoutMs()`, `workerCompatDate()`, `opsSiteUrl()` read through `unwrapEnv` |
| `apps/api/src/services/ops-router-deploy.test.ts` | binding assembly: present / absent / quoted, and that the message never names a variable that is set |
| `apps/api/src/services/cf-deploy.test.ts` | pasted values across bucket, account id, token, timeout |
| `apps/api/.env.example` | the Act-2 block that `ENV_REFERENCE.md` already promised was there |
| `docs/AKT2_PHASE2_FOUNDER_WINDOW.md` | §1a the two binding variables; §7 rows for both skips and for the 10019 follow-on |
| `apps/web/app/dashboard/konsole/strings.ts` | the founder-actions heading no longer says "Cloudflare dashboard" when the action is a Railway variable |

## Honest limits

- Nothing here was run against the live Cloudflare account or the live Railway
  environment. This session has neither, by design. That `CF_R2_BUCKET` is the
  empty one is read off the report's own logic — `APPS` is the R2 binding, and
  `ROUTES` is checked first and passed — not off the founder's dashboard.
- The EU-jurisdiction binding question in §3 is unresolved and stays unresolved
  until an upload actually runs.
  → **Resolved 2026-08-11** — the upload ran, answered `10085`, and the cause was the
  jurisdiction. `docs/ROUTER_R2_JURISDICTION_BINDING.md` carries the full answer: the
  bucket did **not** have to be recreated, one Railway variable (`CF_R2_JURISDICTION=eu`)
  closed it, and the router has published through it since — Phase-2 E2E green 2026-08-12,
  `evidence/akt2-phase2/e2e-founder-window-2026-08-12.json`. (Stamped 2026-08-13.)
