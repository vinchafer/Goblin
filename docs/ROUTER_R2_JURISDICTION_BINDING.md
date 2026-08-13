# Binding an EU-jurisdiction R2 bucket to a Worker

**2026-08-11 · the question PR #82 flagged and deliberately did not patch blind.**

The symptom, from `POST /api/ops/router/provision` on production, one step further
along than the run in `ROUTER_PROVISION_BINDING_DIAGNOSIS.md`:

```
worker: "workers:upload: 10085 R2 bucket 'goblin-apps' not found.
         Verify the bucket exists in your account and that the bucket_name in
         your configuration is correct."
```

`CF_R2_BUCKET` is now present in the process — the empty-binding refusal is gone
and Cloudflare itself is answering. And what it says is false on its face:

- the dashboard shows `goblin-apps`, **jurisdiction EU**
- the Phase-1 round-trip **wrote and read objects in that same bucket** through
  `<hash>.eu.r2.cloudflarestorage.com`

So the bucket exists, the credentials reach it, and the upload still cannot find
it. Both facts are true at once, and the reason is the jurisdiction.

---

## The answer, in one line

**A jurisdiction bucket lives in a separate namespace, and the jurisdiction must
be named ON the `r2_bucket` binding. `"not found"` is literally true from the
default namespace — the bucket is not there. It is in the EU one.**

The Workers API *can* bind it. Nothing has to happen to the bucket.

---

## 1. The documentation conflict, settled

This was worth settling rather than guessing, because Cloudflare's own reference
pages disagree, and one of them says the fix is impossible.

| Source | Retrieved | Says |
|---|---|---|
| [Workers multipart upload metadata](https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/) | 2026-08-11 | r2_bucket binding is `{type, name, bucket_name}`. **No jurisdiction field.** |
| [R2 data location](https://developers.cloudflare.com/r2/reference/data-location/) | 2026-08-11 | "To access R2 buckets that belong to a jurisdiction from Workers, you need to specify the jurisdiction as well as the bucket name as part of your bindings." Shows `jurisdiction` on the r2_bucket entry, JSON and TOML. |
| [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) | 2026-08-11 | `r2_buckets[].jurisdiction`, optional — "The jurisdiction where this R2 bucket is located". |
| [cloudflare-typescript](https://github.com/cloudflare/cloudflare-typescript) `src/resources/workers/scripts/scripts.ts` | 2026-08-11 | `WorkersBindingKindR2Bucket = {bucket_name, name, type: 'r2_bucket', jurisdiction?: 'eu' \| 'fedramp' \| 'fedramp-high'}` |

**The most defensible reading: the metadata reference page is incomplete, not
authoritative-by-omission. The field goes on the binding.**

Why the last row wins the tie:

1. It is Cloudflare's **generated API client** — it describes the REST endpoint
   this adapter actually calls, not a config-file format.
2. Wrangler has no private channel. It uploads through the **same** script-upload
   endpoint, so a field wrangler can express has to survive the wire.
3. Cloudflare **validates** the field: a bad value comes back as its own error
   10021 "invalid jurisdiction" (reported alongside this 10085 in
   [cloudflare/workers-sdk#9059](https://github.com/cloudflare/workers-sdk/issues/9059)).
   An API that did not parse `jurisdiction` could not reject a wrong one.

The honest caveat: the metadata reference is the page describing the exact call
being made, and it does not list the field. That is why this is stated as the
most defensible reading rather than as certainty — and why the failure mode is a
refusal rather than a silent fallback (§3).

---

## 2. Which other call paths are jurisdiction-sensitive

Checked, not assumed. Three call paths touch R2 or KV:

| Path | Jurisdiction-sensitive? | State |
|---|---|---|
| Worker script upload — `r2_bucket` binding | **Yes** | **Was broken. Fixed here.** |
| S3 API (`getR2Client`, all object reads/writes) | **Yes — via the endpoint host** | **Already correct.** `CF_R2_ENDPOINT` is founder-supplied and already `<hash>.eu.r2.cloudflarestorage.com`. The jurisdiction is in the hostname; nothing in code composes it. This is why Phase 1 passed while the binding failed. |
| Worker script upload — `kv_namespace` binding | **No** | Unchanged. KV has no jurisdiction concept: Cloudflare's binding schema defines `{type, name, namespace_id}` and the wrangler docs list no jurisdiction field for `kv_namespaces`. A namespace id is globally unique and addresses itself. |

Not present in this codebase, so not fixed: the **R2 REST management API**
(create/list bucket) takes jurisdiction as a `cf-r2-jurisdiction` *header* rather
than a field. This adapter never creates or lists buckets — grep for `/r2/buckets`
returns nothing — so there is no third code path to change.

**Nothing else needed a fix.**

---

## 3. What changed

`CF_R2_JURISDICTION`, read through PR #77's hardened unwrapper like every other
env value on this path, so a pasted `CF_R2_JURISDICTION="eu"` is read as `eu` and
not as the four-character string `"eu"` — which Cloudflare would answer with
10021. Case-folded, because the dashboard displays it as "EU".

- **unset** → default namespace, no `jurisdiction` key on the binding at all
- **`eu` / `fedramp` / `fedramp-high`** → carried onto the `r2_bucket` binding
- **anything else** → **the upload is refused**, and the founder action names the
  variable, the value and the accepted set

The third case is the one worth defending. The tempting behaviour is to drop an
unrecognised value and bind the default namespace. That would mean a typo silently
moves where user data is addressed from, while the founder believes it is pinned
to the EU — and the privacy page now names Cloudflare as a sub-processor **with R2
in the EU**. A refusal is the only answer that cannot quietly make that page
wrong. `"eu"` is not hardcoded anywhere: the default is unset, which is the
default namespace.

The 10085 founder action was also rewritten. It used to fall through to the
token-permissions block, which told the founder to add three scopes the token
demonstrably already had — an upload that gets an answer *about a bucket* has
already passed authorization. Sending someone to a dashboard page that is already
correct is worse than saying nothing: it burns the one thing they have and it
teaches them the report is guessing. It now names the jurisdiction cause first,
and both directions of the mismatch.

---

## 4. Does the bucket have to be recreated?

**No.** This is worth stating explicitly because it was the fallback plan.

The API can bind an EU bucket. There is no decision table to present, no migration
of the (near-empty) contents, and no data-residency trade-off to weigh — the
option that would have cost residency is simply not needed. R2 in the EU stays
true, and the privacy page stays accurate without amendment.

A jurisdiction cannot be changed after a bucket is created, so if the two ever
disagree again, **the variable is what moves, never the bucket.**

---

## 5. Founder action

> **DONE — this action was carried out and the fix held.** Read the section as the record of
> what was asked for, not as an open item. The evidence is one step downstream: the Phase-2
> founder-window E2E ran green on 2026-08-12 (19/19 steps, `publishLoops` 5/5) against the real
> router on `justgoblin.app` — `evidence/akt2-phase2/e2e-founder-window-2026-08-12.json`. The
> router cannot be provisioned at all while the binding fails, so a green publish loop is proof
> the variable is set and the EU namespace is bound. Stamped 2026-08-13, Act-2 consistency sweep.

One variable, in Railway → the Goblin API service → Variables:

```
CF_R2_JURISDICTION = eu
```

Lower case, no quotes needed (quotes are stripped if pasted anyway). Save, wait
for the redeploy to finish, then re-run `POST /api/ops/router/provision`.

The `worker` step should come back `ok` and say so out loud:

```
uploaded goblin-apps-router (… bytes) with 4 bindings (R2 jurisdiction: eu)
```

That suffix is in the success line on purpose. It ends up in an evidence file, and
"which namespace did the router actually get bound to" is exactly the question a
data-residency claim has to be answerable from.

Nothing else changes. `CF_R2_ENDPOINT`, `CF_R2_BUCKET`, `CF_KV_NAMESPACE_ID` and
the API token are all already correct.
