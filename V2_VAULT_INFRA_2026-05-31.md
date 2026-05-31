# v2 Vault Encryption — Infra Investigation (2026-05-31, Sprint 3 R4)

Read-only investigation (no code/encryption changes, no DB mutations). Sprint 2 noted BYOK
tokens fall back to v1 because `gen_random_bytes` errors. **Root cause now pinned — and it is
NOT a missing extension.**

## v1 vs v2 (from `apps/api/src/lib/byok-encryption.ts`)
- **v1** (`encryptUserData`): AES from `ENCRYPTION_KEY` + per-user salt (scrypt). Works today;
  Sprint-2 token store and Sprint-3 deploy proof both used v1 successfully.
- **v2** (`encryptApiKeyV2`, `CURRENT_ENCRYPTION_VERSION = 2`): AES-256-GCM with a per-user KEK
  stored in Supabase **Vault**, resolved via RPCs `get_or_create_user_kek` / `read_user_kek`.
  New keys *try* v2 first, fall back to v1 on error.

## Root cause (pinned)
`supabase/migrations/0043_byok_per_user_encryption.sql`:
- L41-45: `get_or_create_user_kek` is declared with **`set search_path = vault, public`**.
- L65: it calls **unqualified** `gen_random_bytes(32)`.

In Supabase, `pgcrypto` (which provides `gen_random_bytes`) lives in the **`extensions`**
schema — which is **not** in this function's `search_path`. So the call resolves against
`vault`/`public` only → `function gen_random_bytes(integer) does not exist` → v2 fails → v1
fallback. The migration does **not** (and does not need to) `create extension pgcrypto`;
pgcrypto is already available in the `extensions` schema on Supabase by default.

**So this is a search-path bug, not a missing-extension problem.** No extension enablement is
required (and therefore no founder DB-admin extension decision per the stop condition).

## Recommended fix (NOT applied — deferred per R4 "no encryption-path changes this run")
A one-line migration. Either:
- **(preferred)** add the schema to the function search_path:
  `set search_path = vault, public, extensions` on both `get_or_create_user_kek` and
  `read_user_kek` (apply the same to any other Vault RPC using pgcrypto), **or**
- schema-qualify the call: `extensions.gen_random_bytes(32)`.

Then existing v1 rows lazily re-encrypt to v2 on next decrypt (the code already attempts this:
the Sprint-2 log line "byok: lazy v1->v2 reencrypt failed (read still succeeded)" is exactly
this path failing on the same root cause).

## Risk / why deferred
- Touches an encryption-adjacent DB function → needs its own change with verification (encrypt
  a key → confirm v2 blob → decrypt round-trip) against the test user. R4 is explicitly
  doc-only/optional and says not to alter encryption paths this run.
- v1 works and is secure (per-user salt + scrypt + AES); this is an upgrade, not a fix for a
  broken state. **Non-blocking for beta.**

## Verdict
v2 is one search-path token away from working. No extension enablement needed. Schedule the
one-line migration + round-trip verification as a small standalone Sprint-4 task.
