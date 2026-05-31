# Error-State Pass (2026-05-31, Sprint 3 B14)

The audit couldn't verify error states. This is a **code-level review** of the three
scenarios (live triggering needs a browser session — browser-harness unavailable while founder
asleep). Current behaviour documented; the clear, safe fix applied.

## Scenario A — Network kill / server unreachable
- **Chat** (`components/workspace/chat-tab.tsx`): the SSE stream both handles an in-band
  `{type:'error'}` event (L193) and a thrown fetch error in `catch` (L202). Both call
  `setError(...)`, stop streaming, and restore the prior messages — **no infinite spinner, no
  stack trace surfaced**. ✅
- **Deploy** (`hooks/code/useCodeVercel.ts`): `catch` sets `deployMessage` to the error and
  clears `deploying` in `finally`. ✅
- **FIXED**: the two chat error strings were English in a DE app surface → translated to DE
  ("Etwas ist schiefgelaufen…", "Server nicht erreichbar…"). Improves both the network-error
  UX and B6 consistency.

## Scenario B — Rate-limit (429)
- **Support chat** (`components/support/support-chat.tsx`): explicit `res.status === 429`
  branch → shows a friendly `rateLimited` message (L59-61, L174). ✅
- **Deploy** (`services/vercel-service.ts`): 429 → "Vercel API rate limit reached. Wait a few
  minutes and try again." ✅
- **Gap (functional, not critical)**: the **main chat** has no dedicated 429 branch — a
  provider 429 surfaces via the generic error event/message rather than a "try again in N
  seconds" hint. Acceptable (still a clear message, no crash); a friendlier 429 mapping in the
  chat path is a Sprint-4 nicety.

## Scenario C — Invalid BYOK key
- **On add** (`components/settings/add-key-modal.tsx`): `createKey` validates against the
  provider before storing; failure → 400 → inline `setError` (now DE after B6). ✅
- **On use** (chat): an invalid/expired key → API error → chat error event; the
  decryption-needs-reentry case has a dedicated banner (`chat-tab.tsx` L245, "re-entered"). ✅

## Other observations
- `hooks/code/useCodeInjections.ts` has two `catch { /* silent */ }` blocks (L60, L90) on the
  injection poll/ack path. Silent failure is acceptable for a secondary poll but could mask a
  real problem — **Sprint-4: log or surface these** (functional, low severity).

## Verdict
Error handling **exists and maps to user-facing messages** across all three scenarios — no
infinite-spinner or raw-stack-trace failure modes found in code. Applied the one clear safe
fix (DE chat error copy). Remaining items (chat 429 hint, silent injection catches) are
functional niceties for Sprint 4. **Live triggering of each scenario in a browser is the
honest remaining verification step** — blocked this run (browser-harness needs Chrome
remote-debugging; founder asleep).
