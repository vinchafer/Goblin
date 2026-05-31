# Language Unification (2026-05-31, Sprint 3 B6)

Canon (founder-locked): app `/dashboard/*` = **DE**, marketing `/`,`/pricing`,`/help`,`/terms`,`/imprint` = **EN**, auth `/login`,`/register`,`/welcome` = **DE**. Tech terms (Deploy, Build, Preview, Provider, Label, API Key, BYOK) stay as-is in both.

This was a **scoped pass**, not a full bilingual sweep (budget; browser-harness blocked so
no live walk-through). Clear in-app EN drift fixed; remaining drift mapped for Sprint 4.

## Fixed this run
- **`components/settings/add-key-modal.tsx`** (in-app settings → must be DE; was EN): title
  "Connect X" → "X verbinden"; description, "Don't have a key?" hint, placeholder, "Cancel"
  → "Abbrechen", "Connect →" → "Verbinden →", and three error strings (Not authenticated /
  Failed to add key / Something went wrong) → DE. Kept "Provider", "Label", "API Key" (tech).

## Drift mapped — deferred to Sprint 4 (with rationale)

| Surface | Current | Canon | Effort | Note |
|---------|---------|-------|--------|------|
| `app/help/page.tsx` (marketing /help) | **DE** | EN | M (full FAQ translation) | The audit's Rajesh blocker. The in-app `components/settings/HelpCenterPage.tsx` is correctly DE; the **marketing** /help page needs EN. Substantial FAQ text — deferred as its own task. |
| Other settings components | spot-checked DE-correct (`HelpCenterPage`, `DecryptLogPage`, `ConnectorsPage`, `BillingPage` "Lade…", "Abrechnung") | DE | — | No action. |
| `/pricing` | not fully audited this pass | EN | S–M | Verify in Sprint 4 (likely EN already; confirm). |
| API error strings (`apps/api`) | many EN (dev-written) | surfaced in DE app | M | Backend errors bubble to DE UI. A pass to DE-ify user-facing API errors (or map them client-side) is a Sprint-4 item. Not done — backend error copy is a broad surface. |

## Method note / honesty
Static grep-based scan (German-word probe in marketing dirs; English-sentence probe in
dashboard components). Not a click-through walk (browser-harness needs Chrome remote-debugging,
unavailable while founder asleep). So this catches obvious hardcoded-string drift, not
context-dependent or dynamically-composed strings. The biggest remaining item is translating
the marketing `/help` page to EN — flagged, not done, to avoid a rushed large translation.
