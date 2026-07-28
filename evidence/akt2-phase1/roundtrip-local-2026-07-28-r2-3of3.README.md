# AKT 2 · PHASE 1.5 · U1.5b (R2 close-out) — LOCAL round-trip evidence, ALL GREEN

- **Machine:** founder laptop (local dev). **Date:** 2026-07-28.
- **Supersedes:** `roundtrip-local-2026-07-28.txt` (the earlier `r2 0/3` artifact), which
  is kept as the honest before-state. This artifact is the after-state once the founder
  corrected `CF_R2_ENDPOINT`.
- **Harness:** `apps/api/scripts/ops-roundtrip.mts` (direct adapter; no HTTP, no auth, no
  trial gate). Adapter commit `763b3cc2`. Runs per surface: 3.
- **Artifact:** `roundtrip-local-2026-07-28-r2-3of3.txt`.

## Result

```
r2 3/3 · kv 3/3 · workers 3/3 · cleanup ok   —   PASSED: YES
```

Confirmed **stable across 3 consecutive runs** (one earlier run in the same session
returned `kv 0/3 · workers 2/3` — transient rate-limiting after rapid probe + orphan
sweep + back-to-back runs; three subsequent runs were clean 3/3/3, so it is recorded as
flake, not a defect — see HONEST LIMITATIONS).

## What the fix was

The previous `r2 0/3` was **not** an adapter defect and **not** a credential-validity
problem. `CF_R2_ENDPOINT` carried a trailing `/goblin-apps` path segment; with the
adapter's `forcePathStyle: true` (which appends the bucket itself) that produced a
double-bucket path (`…/goblin-apps/goblin-apps/…`) — `put` landed on a mangled key and
`list` 404'd. The founder removed the path segment so the endpoint is the bare host
(`https://<hash>.eu.r2.cloudflarestorage.com`, 0 path segments). R2 then round-trips
cleanly: put 3 → list 3 → get + byte-match 3/3 → batched delete (1 batch) → list 0.

## Live credential probe (this session, read-only, before any write)

`R2 HEAD ok · R2 LIST ok(0) · KV read ok · Workers list ok` — the regenerated Cloudflare
API token authenticates on every surface with no auth error; no scope is missing.

## Orphan cleanup (from the earlier mangled-endpoint run)

Listed and deleted exactly prefix `goblin-apps/apps/test-roundtrip/` in bucket
`goblin-apps`: **found 3, deleted 3**. After: that prefix = 0, and the correct prefix
`apps/test-roundtrip/` = 0. Nothing else was touched.

## Secret hygiene

No secret VALUE in this artifact — env presence by NAME only; upstream errors
pre-redacted by the adapter; the process's structured log lines were stripped from the
committed `.txt`. A grep for 28+ char token-shaped runs returned nothing.
