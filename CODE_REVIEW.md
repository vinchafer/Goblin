# Code Review — Goblin (2026-04-30)

## Executive Summary

Goblin is a well-structured TypeScript monorepo with clean separation of concerns between the API (Hono/Node.js), frontend (Next.js 14), and shared packages. The architecture is sound, security patterns like IDOR checks and AES-256-GCM encryption are properly implemented, and the SSE streaming pipeline is correct. However, there is one **critical production incident waiting to happen**: real secrets (Supabase service role key, Stripe secret, GitHub OAuth secret, encryption master key, storage credentials) are committed in `.env` at the repo root. Beyond that, two API contract mismatches between frontend and backend will silently drop messages, a race condition in usage counting allows limit bypassing under load, and the `/api/notifications/send` endpoint is publicly accessible with no authentication.

---

## Critical Issues (must fix before production)

### 1. Real secrets committed to the repository

- **File:** `/.env` (root of repo)
- **Severity:** Critical
- **Description:** The committed `.env` file contains live credentials: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `ENCRYPTION_KEY`, `GITHUB_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STORAGE_KEY`, `STORAGE_SECRET`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The `ENCRYPTION_KEY` in particular is the master key protecting every user's stored API keys. Any person with git access — or any future leak of the repo — has full admin access to the database, can decrypt all BYOK keys, and can make Stripe charges.
- **Fix:** Immediately rotate all of these credentials. Add `.env` to `.gitignore`. Use `git filter-branch` or `git-filter-repo` to purge the file from history. Create a proper `.env.example` at the **root** level (the existing one is only in `apps/web/`) and document all required API keys without values.

---

### 2. `/api/notifications/send` is publicly accessible — anyone can push to any user

- **File:** `apps/api/src/routes/notifications.ts:149`
- **Severity:** Critical
- **Description:** The `/api/notifications/send` POST endpoint has no `authMiddleware`. Only `/subscribe`, `/unsubscribe`, and `/test` are protected. The endpoint accepts a `userId` in the request body (a UUID) and sends push notifications to that user's devices. An unauthenticated attacker who knows or guesses a userId can spam any user with arbitrary push notifications.
- **Fix:** Add `notifications.use('/send', authMiddleware)` and change the endpoint to use `c.get('userId')` from the token rather than accepting `userId` from the body, or alternatively restrict it to an internal service call guarded by a shared secret header.

---

### 3. API contract mismatch — chat streaming events silently dropped

- **File:** `apps/web/components/chat/chat-container.tsx:131-133` vs `apps/api/src/routes/chat.ts:115-123`
- **Severity:** Critical
- **Description:** The backend sends SSE events with `type: 'delta'` and `type: 'done'`, but `ChatContainer` listens for `type: 'token'` and `type: 'message_end'`. As a result, streaming messages received through `ChatContainer` are silently discarded — the component accumulates nothing and the user sees no response. The correct handler in `ChatTab` uses the right event names (`delta`/`done`), but `ChatContainer` is used in a separate path and is broken.
- **Fix:** Update `ChatContainer` lines 131-133 to match the backend protocol:
  - `parsed.type === 'token'` → `parsed.type === 'delta'`
  - `parsed.type === 'message_end'` → `parsed.type === 'done'`
  - `parsed.messageId` field is correct; `parsed.model_used` and `parsed.source_tier` are available on the `done` event.

---

### 4. Race condition in usage limit middleware allows limit bypass

- **File:** `apps/api/src/middleware/usage-limit.ts:43-47`
- **Severity:** Critical
- **Description:** The middleware reads `monthly_requests_used`, checks the limit, then writes `used + 1` in two separate non-atomic operations. Under concurrent requests (two tabs, two devices), both reads see the same count, both pass the limit check, and both increment by 1 from the same base. A user at limit 199/200 can send 10 simultaneous requests and all will be allowed. For a billing-critical feature this is a real revenue leak.
- **Fix:** Replace the read-modify-write with a Supabase RPC that does an atomic `UPDATE users SET monthly_requests_used = monthly_requests_used + 1 WHERE id = $userId AND monthly_requests_used < monthly_limit RETURNING monthly_requests_used`. If the update matches 0 rows, return 429.

---

## High Priority

### 5. `authMiddleware` creates a new Supabase client per request

- **File:** `apps/api/src/middleware/auth.ts:13-16`
- **Severity:** High
- **Description:** Every authenticated request instantiates a fresh `createClient()`. The Supabase JS client holds connection pools and HTTPS keep-alive state. Creating one per request wastes memory, prevents connection reuse, and adds ~10-20ms overhead per call. The singleton pattern already exists in `apps/api/src/lib/supabase.ts` (`getSupabaseAdmin()`) but is not used here.
- **Fix:** Replace the inline `createClient()` call in `auth.ts` with `getSupabaseAdmin()` from `../lib/supabase`.

---

### 6. `PLANS` config reads `process.env` at module parse time — values will be `undefined` in test/CI environments

- **File:** `apps/api/src/config/plans.ts:9-18`
- **Severity:** High
- **Description:** `STRIPE_PRICE_SEED`, `STRIPE_PRICE_CRAFT`, and `STRIPE_PRICE_FORGE` are evaluated when the module loads. If the env vars are not set (missing in CI, wrong deploy order), `stripePriceId` will be the string `"undefined"`. `getPlanFromPriceId` will then never match any plan, silently defaulting billing to `'seed'`. These vars are also not in `REQUIRED_ENV` in `index.ts`, so startup validation does not catch the problem.
- **Fix:** Add `STRIPE_PRICE_SEED`, `STRIPE_PRICE_CRAFT`, and `STRIPE_PRICE_FORGE` to `REQUIRED_ENV` in `apps/api/src/index.ts`. In `plans.ts`, guard with `if (!process.env.STRIPE_PRICE_SEED) throw new Error(...)` or use a lazy getter pattern.

---

### 7. `exchangeCodeForToken` does not validate the GitHub response

- **File:** `apps/api/src/services/github-oauth.ts:9-27`
- **Severity:** High
- **Description:** The function returns `data.access_token` without checking if the property exists or if `response.ok` is true. GitHub returns a 200 with `{ error: 'bad_verification_code', error_description: '...' }` when the code is invalid or reused. The undefined token then gets stored encrypted in the database via `saveGitHubConnection`, silently corrupting the user's GitHub connection with an encrypted `undefined` value.
- **Fix:** After `const data = await response.json()`, add:
  ```ts
  if (!response.ok || data.error || !data.access_token) {
    throw new Error(data.error_description || 'GitHub OAuth failed');
  }
  ```

---

### 8. Project generator ignores the `byokKeyId` parameter — uses first available key instead

- **File:** `apps/api/src/routes/projects.ts:125-126` and `apps/api/src/services/project-generator.ts:31-52`
- **Severity:** High
- **Description:** The `/api/projects/:id/generate` route validates and accepts a `byokKeyId` field from the request, passes it to `generateProject`, but `generateProject` ignores it entirely and instead calls `getFirstActiveKey(userId)` which picks the highest-priority key by provider order. The user's explicit key selection has no effect.
- **Fix:** Either remove the `byokKeyId` parameter from the schema (if not intended to be used), or pass it through to `getFirstActiveKey` and look up that specific key by ID with ownership verification.

---

### 9. `dangerouslySetInnerHTML` with user-controlled content in chat

- **File:** `apps/web/components/workspace/chat-tab.tsx:325-329`
- **Severity:** High
- **Description:** `parseMarkdown(message.content).parsed` is set via `dangerouslySetInnerHTML`. The `parseMarkdown` function does regex replacement of `**`, `*`, and `` ` `` patterns directly into HTML strings without sanitization. An attacker who crafts a message via the API (or compromises the assistant response) can inject arbitrary HTML including `<script>` tags. The `inline-code` class replacement in particular does not escape the content inside the backticks.
- **Fix:** Run the output through a sanitizer like `DOMPurify.sanitize()` before setting it as inner HTML, or switch to a library like `react-markdown` with `rehype-sanitize` which handles this safely.

---

### 10. `project-generator.ts` is a full copy of model-router routing logic — diverged and stale

- **File:** `apps/api/src/services/project-generator.ts:18-29`
- **Severity:** High
- **Description:** `PROVIDER_PRIORITY` and `OPENAI_COMPATIBLE` are duplicated from `model-router.ts` verbatim. They have already diverged: `model-router.ts` has `google` in `OPENAI_COMPATIBLE`, but `project-generator.ts` maps `'openai'` to the Cerebras provider config entry. Any future provider addition must be updated in two places. This is a classic DRY violation with an active bug potential.
- **Fix:** Export `OPENAI_COMPATIBLE` and `PROVIDER_PRIORITY` from `model-router.ts` and import them in `project-generator.ts`. Alternatively, refactor `resolveModel` to accept an optional key ID parameter and reuse it in the generator.

---

## Medium Priority

### 11. In-memory rate limiter does not survive restarts and is not shared across instances

- **File:** `apps/api/src/middleware/rate-limit.ts:3-5`
- **Severity:** Medium
- **Description:** `stores` is a module-level `Map`. On Railway, any redeploy or crash resets all rate limit counters. More importantly, if the API ever scales to more than one instance, each instance has an independent counter — a user can exceed limits by sending requests round-robin across instances.
- **Fix:** Replace with a Redis-backed rate limiter. If Redis is not available, use Supabase with a `rate_limit_counters` table as a transient store. For now, at minimum document this limitation clearly in the code.

---

### 12. Delete project route does not delete project files from storage

- **File:** `apps/api/src/routes/projects.ts:76-99`
- **Severity:** Medium
- **Description:** `DELETE /api/projects/:id` deletes the database row but does not call `deleteProject(projectId)` from `file-storage.ts`. Project files accumulate indefinitely in S3/Backblaze after the project is removed, creating storage cost leakage.
- **Fix:** Add `await deleteProject(projectId)` after verifying ownership and before (or after) the database delete. Handle errors gracefully since storage cleanup failing should not block the response.

---

### 13. `pending-injections` endpoint marks records as applied before confirming client receipt

- **File:** `apps/api/src/routes/projects.ts:265-271`
- **Severity:** Medium
- **Description:** The endpoint fetches pending injections, immediately marks them as `applied_at = now()`, and then returns them. If the HTTP response is lost (network error, client disconnect), the injections are permanently marked as applied but were never received. The user loses their code injection silently.
- **Fix:** Either use a two-phase approach (fetch, deliver, then client calls a separate `/acknowledge` endpoint), or move the `applied_at` update to after the response is confirmed. At minimum, add a client-side retry mechanism with idempotency.

---

### 14. `getFile` is called once per file inside `createZip` — sequential reads are slow for large projects

- **File:** `apps/api/src/services/file-storage.ts:248-259`
- **Severity:** Medium
- **Description:** `createZip` iterates files with a `for...of` loop and `await getFile()` inside, fetching files one at a time from S3. For a 50-file project this serializes 50 round-trips. At ~50ms per S3 GET, that is 2.5 seconds minimum just for reads, blocking the download response.
- **Fix:** Replace with `Promise.all(files.map(f => getFile(projectId, f)))` to fetch all files concurrently.

---

### 15. `outputTokens` in model-router is incremented once per event, not by actual token count

- **File:** `apps/api/src/services/model-router.ts:287` and `:310`
- **Severity:** Medium
- **Description:** `outputTokens++` increments by 1 for each SSE chunk/event, not by the actual token count of the delta. Anthropic's SDK emits one event per token for text deltas, so this is accidentally correct for Anthropic. For OpenAI-compatible providers, one chunk may contain multiple tokens. The logged `output_tokens` in `agent_runs` is inaccurate for all OpenAI-compatible providers.
- **Fix:** For Anthropic, use the `message_delta` event's `usage.output_tokens`. For OpenAI-compatible, accumulate from `chunk.usage?.completion_tokens` in the final chunk where `usage` is present.

---

### 16. `ChatTab` and `ChatContainer` both implement identical streaming — two parallel implementations

- **File:** `apps/web/components/workspace/chat-tab.tsx` and `apps/web/components/chat/chat-container.tsx`
- **Severity:** Medium
- **Description:** Two components independently implement SSE streaming, chat history loading, message state management, and abort handling. Beyond the protocol mismatch (issue #3), any future API change must be applied to both. `ChatContainer` appears to be the newer implementation based on its hook usage pattern, while `ChatTab` is the one that actually works (correct event names). It is unclear which is the canonical implementation.
- **Fix:** Remove `ChatTab` and make `ChatContainer` the single implementation after fixing the event name mismatch. Alternatively, extract a shared `useChatStream` hook.

---

### 17. `useEffect` missing dependencies in `code-tab.tsx`

- **File:** `apps/web/components/project/code-tab.tsx:166`
- **Severity:** Medium
- **Description:** The auto-save `useEffect` depends on `editorContent` and `activeFile?.path`, but `saveFile` is a `useCallback` that also has dependencies (`activeFile`, `projectId`, `token`). However `saveFile` is not in the effect dependency array. If `token` changes (session refresh), `saveFile` captures the stale token ref while the effect continues to use the old closure. This can cause saves with an expired token.
- **Fix:** Add `saveFile` to the dependency array on line 166: `[editorContent, activeFile?.path, saveFile]`.

---

### 18. `models.ts` uses `any` type cast for `provider` parameter

- **File:** `apps/api/src/routes/models.ts:105`
- **Severity:** Medium
- **Description:** `getActiveKey(userId, provider as any)` casts an unvalidated string parameter from the URL directly to `ByokProvider`. If a client sends a malformed provider like `../../../etc/passwd`, it goes through to a Supabase `.eq()` query which is safe from SQL injection (parameterized), but the `as any` defeats TypeScript's type safety for the entire function.
- **Fix:** Validate the provider against the `ByokProviderSchema` enum before calling `getActiveKey`. Return 400 for invalid providers.

---

## Low / Cleanup

### 19. `packages/shared/src/index.ts` exports nothing

- **File:** `packages/shared/src/index.ts:1`
- **Severity:** Low
- **Description:** The file contains only `export {};`. All types are imported directly from `@goblin/shared/src/schemas` throughout the codebase. Either the package entry point should re-export from `schemas.ts`, or consumers should be pointed to the correct path consistently.
- **Fix:** Add `export * from './schemas';` to `index.ts` and update imports across the codebase to use `@goblin/shared` instead of `@goblin/shared/src/schemas`.

---

### 20. `ChatMessageSchema` defines `source_tier` as `'hosted' | 'free' | 'byok'` but backend writes `'free_api'`

- **File:** `packages/shared/src/schemas.ts:19` vs `apps/api/src/routes/chat.ts:134`
- **Severity:** Low
- **Description:** The Zod schema enum for `source_tier` includes `'free'` but the backend inserts `source_tier: currentSourceTier` where `currentSourceTier` is initialized to `'byok'` and updated from `parsed.source_tier` which comes from the model router's `route.layer` value — which can be `'free_api'`. The string `'free_api'` does not match `'free'` in the schema, so frontend Zod validation would fail if messages are ever parsed through the schema.
- **Fix:** Align the schema and backend. Either change the schema to `z.enum(['hosted', 'free_api', 'byok'])` (matching `ModelLayer` in model-router), or normalize the value in the chat route before storing.

---

### 21. `startup-migrations.ts` duplicates Supabase client creation instead of using `getSupabaseAdmin()`

- **File:** `apps/api/src/startup-migrations.ts:17` and `:73`
- **Severity:** Low
- **Description:** Both exported functions call `createClient()` directly and read `SUPABASE_URL` (not `NEXT_PUBLIC_SUPABASE_URL`), creating inconsistency with the rest of the API which uses `getSupabaseAdmin()` that supports both env var names. If `SUPABASE_URL` is not set but `NEXT_PUBLIC_SUPABASE_URL` is, startup migrations will not connect.
- **Fix:** Import and use `getSupabaseAdmin()` from `../lib/supabase` in startup-migrations.

---

### 22. `checkAndMigrate` is exported but never called

- **File:** `apps/api/src/startup-migrations.ts:64`
- **Severity:** Low
- **Description:** The function is a dead code alternative to `runStartupMigrations` that is exported but not imported anywhere.
- **Fix:** Delete `checkAndMigrate` or use it as the sole implementation.

---

### 23. In-memory `memoryStorage` fallback in file-storage.ts leaks memory across projects

- **File:** `apps/api/src/services/file-storage.ts:13`
- **Severity:** Low
- **Description:** `memoryStorage` is a module-level `Map` with no eviction policy. When S3 is not configured (dev mode), every uploaded file accumulates forever for the lifetime of the process. For long-running dev sessions with many generated projects this will grow unbounded.
- **Fix:** Add a max-size cap (e.g. evict oldest entries when size > 500) or add a comment warning that dev mode is not suitable for long-running processes.

---

### 24. Admin route has no protection if `ADMIN_API_KEY` is empty

- **File:** `apps/api/src/routes/admin.ts:9-11`
- **Severity:** Low
- **Description:** The check `if (!expectedKey || !adminKey || adminKey !== expectedKey)` correctly rejects if `expectedKey` is falsy. However if `ADMIN_API_KEY` is not set in the environment (which the `.env` template shows as a blank comment), the admin routes reject all requests. This is safe but may be confusing — a misconfigured deployment has permanently locked admin access with no warning at startup.
- **Fix:** Add `ADMIN_API_KEY` to a `RECOMMENDED_ENV` startup check with a warning log when missing, so operators know it is intentionally disabled vs accidentally missing.

---

## Security Findings

### S1. Committed secrets in `.env` (see Critical Issue #1)

The most severe finding. Treat as immediate incident: rotate all credentials listed above before anything else.

### S2. XSS via `dangerouslySetInnerHTML` with unsanitized markdown (see High Issue #9)

A stored XSS vector if assistant responses are ever manipulated (compromised model key, MITM without HTTPS, or logic bug in the streaming path). Severity is mitigated by HTTPS in production but still a real attack surface.

### S3. Unauthenticated push notification endpoint (see Critical Issue #2)

Allows notification spam to any user by UUID.

### S4. Fixed scrypt salt for BYOK key encryption

- **File:** `apps/api/src/services/encryption.ts:7`
- `scryptSync(masterKey, 'goblin-salt-v1', 32)` uses a hardcoded salt. This is not ideal: a static salt means the derived key is deterministic given the master key, reducing resistance to precomputation attacks if the master key leaks. For a key derivation function, each usage context should ideally use a unique salt. The practical risk here is low (AES-GCM with per-ciphertext random IV provides semantic security), but consider using a per-key random salt stored alongside the ciphertext.

### S5. CORS wildcard fallback for no-origin requests

- **File:** `apps/api/src/index.ts:63`
- Returning `'*'` for requests with no `Origin` header means server-side scripts and curl-style requests get full CORS allowance. For a production API handling user auth tokens this is acceptable only if all sensitive endpoints are protected by `Authorization` header checks (which they are), but `credentials: true` with `'*'` is technically illegal in the Fetch spec — browsers will reject it. Requests from `null` origins (Electron, some mobile clients) may behave unexpectedly.

### S6. No rate limiting on `/api/chat/stream` route

- **File:** `apps/api/src/routes/chat.ts:43`
- `chatStreamRateLimit` is defined in `rate-limit.ts` but is not applied to the chat stream route. The only protection is `usageLimitMiddleware` which has the race condition described in Issue #4. An attacker can call the stream endpoint in a tight loop, consuming LLM API credits from the user's BYOK key or the free-API pool before the monthly counter catches up.
- **Fix:** Add `chat.post('/stream', usageLimitMiddleware, chatStreamRateLimit, async (c) => {` — applying both middlewares in sequence.

### S7. GitHub OAuth `state` stored without expiry enforcement at insert time

- **File:** `apps/api/src/routes/github.ts:23-26`
- The `oauth_states` table insert does not set `expires_at` — this is expected to be a database default. The callback validates `expires_at > now()`, so if the DB default is missing this column will be NULL, and `NULL > timestamp` evaluates to `false` in SQL, effectively rejecting all valid states. Verify the DB schema sets `expires_at DEFAULT now() + interval '10 minutes'`.

---

## Positive Findings

- **Consistent IDOR protection:** Every route that operates on a project verifies ownership with `.eq('user_id', userId)` before proceeding. This is correct and consistently applied across all project routes including files, injections, GitHub push, and deploy.

- **AES-256-GCM with random IV:** The encryption implementation in `encryption.ts` correctly uses a random 16-byte IV per ciphertext and includes the GCM auth tag, preventing both IV reuse attacks and ciphertext tampering.

- **BYOK key validation before storage:** `byok-service.ts` validates each API key against the actual provider endpoint before encrypting and storing it. This prevents garbage keys from reaching production usage.

- **Abort signal propagation in SSE streaming:** `chat.ts` correctly listens to `c.req.raw.signal` and propagates it to the async generator via `AbortController`, cleanly terminating upstream LLM requests when the client disconnects.

- **Stripe webhook signature verification:** `billing.ts` uses `Stripe.webhooks.constructEvent()` with the webhook secret, preventing replay and forged webhook attacks.

- **Zod validation on all mutation endpoints:** All POST/PUT routes use `safeParse` with proper error responses, preventing type confusion attacks and providing clean validation error messages.

- **Singleton Supabase admin client:** `lib/supabase.ts` correctly implements a singleton to prevent connection pool exhaustion in most routes (though auth middleware is an exception — see Issue #5).

- **GitHub OAuth state parameter:** The OAuth flow correctly generates a one-time UUID state, stores it server-side, validates it on callback, and deletes it after use, preventing CSRF attacks on the OAuth flow.

- **SSE double-send protection in chat:** The chat streaming route correctly handles both the explicit `done` event path and the fallback path if the generator ends without emitting `done`, ensuring the assistant message is always persisted.
