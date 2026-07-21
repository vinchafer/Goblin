# U3 — The double bar at the bottom (white + bone)

## The layering (named, from the code + tokens)
The chat-session view stacks, bottom-up:
- **App shell root** `dashboard-shell.tsx:225` — `background: var(--surface-page)` = `#FBF7EC` (bone light) / `#133224` (dark).
- **standalone-chat root** `standalone-chat.tsx:633` — `background: var(--surface-2)` = `#F4ECD8` (bone light) / `#0F2B1E` (dark).
- **Composer wrapper** `standalone-chat.tsx:738` — was `background: var(--surface-2)` (bone).
- **ChatInput non-hero root** `ChatInput.tsx:806` — `background: var(--panel)` = `#FFFFFF` (white light) / `#08170F` (dark), and it OWNS the bottom inset: `padding: 10px 16px calc(12px + env(safe-area-inset-bottom))`.

So the element that reaches the home-indicator zone is the **white `--panel` composer**, but it sat inside (and over) a **bone `--surface-2` wrapper**. Two different backgrounds meeting at the safe-area zone → when the composer's white inset and the bone wrapper/page don't perfectly coincide on-device, the bone shows as a **second bar under the white composer**: the founder's "white + bone, wasted space." This is the same family as the #44 de-dup lesson (a double inset leaves a dead `--surface-2` strip).

## The fix
`standalone-chat.tsx:738` wrapper background `--surface-2` → **`--panel`**. The composer region is now ONE continuous `--panel` surface into the inset — no bone layer under the white composer can show. The inset is still applied **exactly once** (by ChatInput). `chat-tab.tsx` already renders the composer with no bone wrapper, so this aligns the two chat surfaces.

No regression: in the healthy case the composer's white already covers the wrapper (env()=0 in a browser tab, and even with the inset the white fills it), so recolouring the covered wrapper is invisible; it only removes the bone strip in the failure case.

## Evidence
- `u3-doublebar-harness.html` + `u3-doublebar.png` — a 375px device model (simulated 34px home-indicator inset), light + dark, BEFORE (bone wrapper meeting the white composer → a strip in the indicator zone) vs AFTER (`--panel` wrapper → one continuous surface into the inset).
- De-dup asserts added to `assert-safe-area-bottom.mjs` (23/23): the wrapper must be `--panel`, must NOT be `--surface-2`, and must not double the inset.

## Honest limitation
The headless model reproduces the *class* of failure (a bone layer under the white composer in the inset zone). The exact pixel manifestation is an iOS-standalone `dvh`/`env()` interaction confirmable only on the founder's device; the fix removes the only redundant bone layer under the composer, so the seam cannot render regardless of which quirk exposes it. Founder re-walk: open a chat, confirm a single continuous surface into the home-indicator zone.
