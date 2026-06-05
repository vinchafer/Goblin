# Phase A — Onboarding Key Persistence: Root Cause (Sprint 10.11)

**Status: ROOT CAUSE PROVEN. Fix applied (now identical to the working Settings
add). Live round-trip not run this session — no spare valid Groq key; flagged
code-verified per plan §3 Phase A.**

## Symptom (founder, prod)
Added a Groq key during onboarding Step 03, saw a "saved" state, finished —
then generation failed "no valid AI key" and the key was absent from
Settings → My Keys. Adding the key in Settings works and persists.

## Root cause: trailing-slash + strict Hono routing + swallowed error
- Settings add (`components/settings/ProviderKeyForm.tsx:68`) POSTs to
  **`/api/byok-keys`** (no trailing slash), checks `res.ok`, surfaces errors. Works.
- Onboarding save (`app/welcome/provider/page.tsx` `saveKey`) POSTed to
  **`/api/byok-keys/`** (trailing slash) inside a `try/catch` that **swallowed
  every error** and marked the card `saved: true` regardless.

The API is `new Hono()` (`apps/api/src/index.ts:102`) — Hono's default is
**strict routing**, so `/api/byok-keys` and `/api/byok-keys/` are different
paths. The create handler is `byokKeys.post('/')` → registered as
`/api/byok-keys`. A POST to `/api/byok-keys/` matches no route → **404**.

### Proof (local Hono, exact mount replicated)
```
POST /api/byok-keys      -> 200 CREATE_OK
POST /api/byok-keys/     -> 404 404 Not Found
POST /api/byok-keys/test -> 200 TEST_OK     (real segment, unaffected)
```
So every onboarding key-save 404'd. The swallow + unconditional `saved:true`
turned a 404 into a fake success → key never persisted, but the UI advanced.
(`/byok-keys/test` validated fine — which is why "Test connection" looked
green and the user trusted the save.)

## Fix (`app/welcome/provider/page.tsx`)
- POST to `/api/byok-keys` (no trailing slash) — **the identical URL the
  working Settings add uses**.
- Check `res.ok`; on failure set the card error and DO NOT mark `saved`.
- On network error, surface it on the card instead of swallowing.
- (Removed the now-pointless `credentials:'include'`; auth is the Bearer header
  from `getAuthHeaders()`, same as Settings.)

Result: an onboarding-added key now hits the same proven persistence path as
Settings, so it is present in Settings → My Keys afterwards and generation works.

## Verification
- Code-path-equivalent: ✅ onboarding now calls the exact endpoint + ok-check as
  the working Settings add.
- Root cause: ✅ proven (Hono strict-routing 404 on trailing slash).
- Live round-trip (fresh hafner4 → add real Groq key in onboarding → present in
  Settings → generate): NOT run — no spare valid Groq key available this
  session, and the web fix is not yet deployed to prod. Founder: with a
  throwaway Groq key, walk onboarding on the deployed build and confirm the key
  appears in Settings → My Keys.
