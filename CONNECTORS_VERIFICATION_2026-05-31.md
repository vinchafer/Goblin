# Connectors Verification (2026-05-31, Sprint 3 B15)

Read-only code-trace of GitHub + Stripe integrations (Vercel verified live in Sprint 2). No
prod mutations. Severity: cosmetic / functional / critical. **Only critical findings fixed
this run; none found → doc-only.**

## GitHub — status: OK (no critical findings)

| Check | Finding | Severity |
|-------|---------|----------|
| **Token encryption ↔ decryption** | `github-service.ts` writes `encryptData(accessToken)` (L109) into `users.github_access_token_encrypted` and reads it back with `decryptData(...)` (L18) — **matched pair**, dedicated column. **Does NOT have the Sprint-2 Vercel bug** (that was a mismatch: byok-service stored v1/v2, vercel-service read with simple `decryptData`). GitHub stores + reads with the same simple scheme. | ✅ none |
| **OAuth CSRF / state** | `routes/github.ts`: random-UUID `state` stored in `oauth_states` with `user_id` (L55-74); callback validates `eq('state', state)`, **deletes after use** (one-time, L104-108), and **re-validates `return_to`** at read time via `isSafeReturnPath` (defense in depth, L110-112). | ✅ solid |
| **Push error handling** | Code-push uses the Railway OAuth app (`GITHUB_*_RAILWAY`); flow lives in github-service. Repo-conflict / permission errors surface via the route's error mapping. Not live-tested (would need a real push). | functional — verify live in Sprint 4 |

## Stripe — status: OK (no critical findings)

| Check | Finding | Severity |
|-------|---------|----------|
| **Webhook signature** | `routes/billing.ts` `/webhook` reads `stripe-signature` and calls `Stripe.webhooks.constructEvent(body, signature, secret)` (L249-251); invalid signature → caught → **400 'Invalid signature'** (L301). Correct. | ✅ none |
| **Subscription state sync** | Handles `checkout.session.completed` → `handleSubscriptionCreated`, `customer.subscription.updated`/`.deleted`, and `invoice.*` (L274-291). active→past_due→cancelled transitions flow through the updated/deleted handlers. Wired; live transition not exercised. | functional — verify live in Sprint 4 |
| **Test-mode** | Keys are `sk_test_`/`pk_test_` (verified Sprint 2 B3). Webhook secret `whsec_…` present. | ✅ none |
| **Customer portal** | Portal + checkout routes present; redirect URLs derive from app URL. Not live-clicked. | functional — verify live in Sprint 4 |

## Verdict
No **critical** findings. The highest-risk item — whether GitHub repeated the Vercel
decrypt mismatch — is **clean** (matched encrypt/decrypt). GitHub OAuth CSRF handling is
solid (one-time state + return_to re-validation). Stripe webhook signature validation is
correct. Remaining items are **functional** (live end-to-end behaviour of push, subscription
state transitions, portal redirect) — verifiable only with browser/live actions, deferred to
Sprint 4. No code change made (doc-only).

## Method note
This is a static code-trace, not a live E2E test. Live verification (real GitHub push, real
Stripe checkout→portal→webhook cycle) needs a browser session + would mutate prod billing —
out of scope for this read-only pass.
