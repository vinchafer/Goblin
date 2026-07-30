# U4 — Auth chain: what this environment could prove, and what it could not

Closes as much of PR #61's untested surface as can be closed without the
founder's devices and without sending real mail.

## Proven here (checkout, `vitest` — not the deployed app)

| Bullet | Where | Result |
|---|---|---|
| Signature verification: valid / invalid / replayed / rotated / **absent secret** | `apps/api/src/routes/auth-email-hook.test.ts` | 22/22 |
| Payload handling for **every** mail type end-to-end through the hook | `apps/api/src/routes/auth-email-chain.test.ts` | 20/20 |
| Resend dispatch mocked, **templates rendered for real** | both files | ✓ |
| Honest failure when `RESEND_API_KEY` is missing | `auth-email-chain.test.ts` | ✓ 500, never 200 |
| `token_hash` + `verifyOtp`, **GET does not consume** | `apps/web/lib/auth/redemption-contract.test.ts` | 8/8 |
| Legacy `?code=` links still work | same file | ✓ |
| Mail previews, all types, DE+EN | `_sprint/akt1-strang-2/mail-previews/` | 5 files |

Totals: API 42 tests across the two hook files; web 189 tests across 22 files.

### "A GET must not consume the token" — how it is proven

This is a property about the *absence* of a code path, so no runtime assertion
can establish it. `redemption-contract.test.ts` reads the source of
`app/auth/confirm/page.tsx` and pins four structural facts:

- `auth.verifyOtp(` is called **exactly once** in the file, and lies inside
  `const redeem = async () =>`;
- the page contains **no `useEffect` at all**, so nothing can fire on mount;
- the only reference to `redeem` is `onClick={redeem}`;
- `redeemed.current` guards a double redemption within one load.

A scanner, a link preview or Gmail's prefetch therefore executes nothing that
spends the token. The complementary behavioural check,
`tests/e2e/32-auth-confirm-interstitial.spec.ts`, drives the **deployed** app and
is not evidence about this checkout.

### Fixed while verifying: `redirect_to` was being silently dropped

`nextPathFrom` compared origins strictly. Supabase derives `redirect_to` from the
project's **Site URL** (the apex, `justgoblin.com`) while `NEXT_PUBLIC_APP_URL` on
the API host is `https://www.justgoblin.com` — the apex 307s to www. Every `next`
therefore failed the comparison and was discarded, so a mail meant to land
somewhere specific fell back to the type default. The apex/www pair is now
treated as one site.

This is not an open-redirect loosening: only `pathname + search` is ever carried
over, never the origin. A foreign origin, a look-alike domain
(`justgoblin.com.evil.example`) and a protocol downgrade are all still rejected,
each with its own test.

## Mail previews

`_sprint/akt1-strang-2/mail-previews/` — `recovery`, `signup`, `email_change`,
`magiclink`, `invite`, plus a README. Regenerate with:

```
pnpm --filter @goblin/api exec tsx src/scripts/render-auth-mail-previews.ts
```

Real templates, real link builder, placeholder token, nothing sent. Each file
carries German **and** English in one message — that is the template design, so
one file per type is the complete bilingual artifact. Spot-checked: the only link
is `https://www.justgoblin.com/auth/confirm?token_hash=…&type=…`, no `?code=`,
no tracking pixel, and no invented validity duration (asserted for all five
types in `auth-email-chain.test.ts`).

## What genuinely cannot be proven without the founder's devices

1. **That a real mail arrives at all.** No message has been sent. Resend is
   mocked everywhere here.
2. **Inbox vs. spam placement.** Depends on live reputation, DKIM/SPF/DMARC and
   the receiving provider. Unknowable from CI.
3. **The cross-device chain.** PWA → Gmail app → Safari hand-off is an iOS
   behaviour, not application logic.
4. **That Supabase actually calls the hook**, and that the secret it signs with
   matches the one on Railway. We can prove the endpoint answers 401 to an
   unsigned call; only a real Supabase-originated call proves the pair.
5. **Whether a real token survives a scanner.** The structural proof above says
   nothing in our code spends it; it cannot speak for Supabase's own endpoints.

### Founder test sequence — test account only (`vinc.hafner3@gmail.com`)

0. Paste the hook URL from `docs/AUTH_EMAIL_HOOK_SETUP.md` into Supabase and save.
1. **Reset, cross-device.** Request a reset in the installed PWA → open the mail
   in the Gmail app → tap the link (opens in Safari) → the page must show a
   **button**, not a result → tap it → the password form appears → set a new
   password → sign in with it.
   *This is the case that always gave "Reset link expired or already used".*
2. **Scanner test.** Copy the link out of the mail and run
   `curl -sI "<link>"` **without** opening it in a browser. Then open it in the
   browser and press the button — it must still work.
3. **Signup confirmation.** Create a fresh account → confirmation mail (check
   spam) → button → sign in.
4. **Language.** Open `/login` in a browser that has never visited Goblin. It
   must be English. Then choose German in the app and reload `/login` — it must
   be German.
5. **Spam placement.** Note for each mail whether it landed in the inbox.

## Honest limitations

- Everything above is the **checkout**. The `@auth` Playwright suite drives the
  deployed app and is not evidence about this diff.
- The `RESEND_API_KEY`-missing test asserts `lib/email.ts` returns
  `{ok:false, error:'resend_not_configured'}` and that the hook turns that into a
  500. It does not exercise a real Resend outage.
- Whether the founder's Supabase **Site URL** is the apex is inferred from the
  default, not read. If it is already the www host, the `nextPathFrom` fix is
  simply inert rather than wrong.
