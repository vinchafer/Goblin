# A-5 · Push notifications — founder setup (VAPID keys)

The push code is **key-agnostic** and ships dormant: with no VAPID keys set it is a
silent no-op (no crash, no false "sent"). To turn it on, generate ONE VAPID keypair and
set it on both services. **The private key must never transit a Claude session** — run
this yourself.

## 1. Generate the keypair (one line, local machine)

```bash
pnpm --filter @goblin/api generate-vapid
# → prints VAPID_PUBLIC_KEY=… and VAPID_PRIVATE_KEY=…
```

(Equivalent: `npx web-push generate-vapid-keys`.)

## 2. Set the Railway / env vars

| Variable | Where | Notes |
|---|---|---|
| `VAPID_PUBLIC_KEY` | **API** (Railway) | from step 1 |
| `VAPID_PRIVATE_KEY` | **API** (Railway) | from step 1 — secret, API only |
| `VAPID_CONTACT` | **API** (Railway) | optional; defaults to `mailto:hi@justgoblin.com` |
| `NEXT_PUBLIC_VAPID_KEY` | **Web** (Vercel) | the **public** key ONLY (same value as `VAPID_PUBLIC_KEY`) |

The web subscribe flow (`usePushNotifications`) reads `NEXT_PUBLIC_VAPID_KEY`; the API
send flow reads the pair. Both must reference the **same** keypair or subscriptions fail
to validate.

## 3. Verify

1. Web: Settings → Benachrichtigungen → toggle **Push-Benachrichtigungen** on → grant
   the browser permission. A `push_subscriptions` row is written for your user.
2. `POST /api/notifications/test` (authenticated) → you should receive a test push.
3. Run an agent task and navigate away → on finish you get "Goblin ist fertig" (or, on a
   verified publish, "Deine App ist live ✓" with the URL). Respects the
   **Build abgeschlossen** (`notify_build_complete`) toggle.

## Honest support matrix (stated in the settings copy)

- **Desktop Chrome / Edge / Firefox:** works once permission is granted.
- **Android Chrome:** works (installed PWA or browser).
- **iOS/iPadOS Safari:** web push works **only** for a PWA **installed to the home screen**
  on **iOS ≥ 16.4**. In the plain Safari tab it does not fire. This is an Apple platform
  limitation, not a Goblin one — the iOS live-notification check is a **founder acceptance
  item**, not something this session can automate.
