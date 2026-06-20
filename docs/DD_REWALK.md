# DD_REWALK — founder live re-walk checklist (post-merge)

Run on the live deploy after merging `dd-hardening-2026-06-20`. These confirm the
fixes that could only be code/test-verified in the autonomous run (no browser, no
real-provider spend). iPhone (390px) AND desktop for each. ✅/❌ as you go.

## P0 — the three walk blockers (must pass)
1. **Start composer dropdown (P0-1).** Dashboard → tap the model pill under
   "Sag Goblin, was du bauen willst." → the model list opens fully visible, ABOVE the
   card, not clipped/behind. Check at 390px AND desktop.
2. **Goblin models selectable in a NEW chat (P0-2).** Open a fresh chat → model pill →
   the "Goblin" section shows **Goblin Swift** and **Goblin Forge** with an
   "INKLUSIVE · KEIN KEY" badge (NOT "SOON"), and each row is tappable/selectable.
3. **Both stream + usage moves (P0-3).** Pick Goblin Swift → send a prompt → it streams
   a reply. Repeat with Goblin Forge. Then Settings → Verbrauch (or /dashboard/usage):
   the weighted Goblin bar moved, and "Pro Modell" shows **Goblin Swift / Goblin Forge**
   (never `goblin/efficient`, never an underlying model name). *(This is the one live
   real-provider check the autonomous run could not do — P-COST. Expect ~$0.001.)*
4. **Same in the in-chat and workspace composers.** Confirm 2–3 also hold in a project
   workspace chat and the standalone chat (same `ChatInput`, should be identical).

## P1 — model-name scrub (F4-1, fixed)
5. Usage "Pro Modell" with mixed history (a BYOK run + a Goblin run): BYOK shows a clean
   name (e.g. "Llama 3.3 70B", no `groq/…/versatile`); Goblin shows "Goblin Swift/Forge".

## Sanity (unchanged surfaces — confirm no regression)
6. BYOK model still selectable + streams (your own key).
7. Publish/deploy loop still works end-to-end (hydrate → save → deploy).
8. `/pricing`, `/privacy`, `/help` still render at 390px (no layout break).

## Known still-open (NOT fixed this pass — see DD_RECOMMENDATIONS, expect current behavior)
- "Gemini 2.0 Flash · FREE" / "Llama 3.3 70B · FREE" still appear in the picker but the
  free pool is OFF — selecting one routes to Goblin Swift, not that model (F5-1, §C).
- Two usage systems still coexist (weighted bar + "Anfragen" count); project chat still
  has the legacy 200-cap (F4-2/3/4, §A). Untouched on purpose (billing coupling).
