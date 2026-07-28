# AKT 2 · PHASE 1.5 · U1.5b — LOCAL round-trip evidence

- **Machine:** founder laptop (local dev), not a cloud sandbox.
- **Date:** 2026-07-28.
- **Harness:** `apps/api/scripts/ops-roundtrip.mts` — loads the local env and calls the
  EXISTING adapter (`services/cf-deploy.ts`) via the EXISTING round-trip
  (`services/ops-selftest.ts` → `runOpsSelftest`). No HTTP, no Supabase login, no auth
  token, no trial gate. The adapter is not reimplemented.
- **Adapter commit under test:** `763b3cc2` (`apps/api/src/services/cf-deploy.ts`).
  Round-trip service: `86f75066` (`apps/api/src/services/ops-selftest.ts`).
- **Runs per surface:** 3.
- **Artifact:** `roundtrip-local-2026-07-28.txt` (the harness's stdout, with the
  process's structured (pino) log lines stripped).

## Result (numbers, not adjectives)

```
r2 0/3 · kv 3/3 · workers 3/3 · cleanup FAILED (R2 only)
```

- **KV — 3/3, cleanup ok.** Real Cloudflare KV. Each run: `setRoute` → `getRoute`
  byte/appId match → `deleteRoute` → `getRoute` gone. The multipart `value`+`metadata`
  write shape (a previously flagged suspect) is CORRECT — 3/3.
- **Workers — 3/3, cleanup ok.** Real Cloudflare Workers. Each run: `deployWorker`
  (133-byte ES module) → `getWorker` exists (318 bytes read back) → `deleteWorker` →
  `getWorker` gone. The ES-module upload format (the other flagged suspect) is CORRECT
  — 3/3.
- **R2 — 0/3, cleanup FAILED.** Every call, including a plain `HEAD` bucket and a
  read-only `LIST`, is rejected `auth: not authorized`. This is **not** an adapter bug
  (KV and Workers prove the same adapter end-to-end against real Cloudflare) and **not**
  a read-vs-write scope issue (even HEAD/LIST fail). The local R2 **S3 credential pair**
  (`CF_R2_ACCESS_KEY_ID` / `CF_R2_SECRET_ACCESS_KEY`) does not authenticate against the
  `goblin-apps` bucket from this machine. See FOUNDER ACTIONS in the phase report.

## What was written and deleted

Only the fixed self-test scope — never any other key, prefix, script or bucket:

- **R2:** would-be prefix `apps/test-roundtrip/` (nothing was actually written — every
  put was rejected at auth).
- **KV:** key `route:test-roundtrip` — created and deleted each run; final cleanup
  confirmed deleted.
- **Workers:** script `goblin-ops-selftest` — deployed and deleted each run; final
  cleanup confirmed already-absent (the suite had already removed it).

`FINAL CLEANUP: r2 FAILED(auth) · kv deleted · workers already-absent` — the R2 cleanup
"failure" is the same auth rejection; nothing was left behind because nothing was written.

## Secret hygiene

No secret VALUE appears in this artifact. Env presence is reported by NAME with a
boolean (`set` / `MISSING`) only — never a value, never a length. Every upstream error
string is passed through the adapter's `redactSecrets()` before it can reach stdout. The
process's structured log lines (which carry only the machine hostname, no secrets) were
stripped from the committed `.txt`.
