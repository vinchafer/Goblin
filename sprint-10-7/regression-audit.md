# Sprint 10.6 Regression Audit (Item 10.7-4)

Code-level audit of the 10.5 B-slices after the 10.6 deploy surfaced the
key-add regression. Goal: find any other 10.6-introduced breakage.

| Slice | Feature | Status | Notes |
|-------|---------|--------|-------|
| B-S1/2 | ModelPicker shows connected-only | OK | `ChatInput`/`useChatModel` unchanged by 10.6; RankingsTab "Nur nutzbare" filter intact in ModelsPage. |
| B-S3 | "Sag Goblin" → 3-option modal | OK (behavior changes in 10.7-12) | dashboard start modal present; 10.7-12 redirects create→chat. |
| B-S6 | Sidebar "Neues Projekt" from any page | OK | Sidebar new-project entry intact; not touched by 10.6. |
| B-S7 | Settings scroll + Modelle key routing | **REGRESSED → FIXED (10.7-1/2)** | New "Meine Keys" add pushed read-only ApiKeysPage (dead end); only working form was legacy AddKeyModal. Root: 10.5 migration left new page formless; 10.6 unrelated. Fixed via ProviderKeyForm. |
| B-S10 | Logo regression hunt | **REGRESSED → tracked 10.7-15** | Chat loading shows green-filled circle vs transparent mark. Fixed in 10.7-15. |
| Chat | Streaming error feedback | **GAP → FIXED (10.7-3)** | project route dropped error events; 120s silent wait. Fixed via watchdog. |

## Findings
1. The only true 10.6-era functional regression traced is the chat-hang
   surface (error events + abort), addressed by 10.7-3. The key-add dead end
   predates 10.6 (incomplete 10.5 migration) but presented after the 10.6
   deploy because Vincent re-tested then — fixed by 10.7-1/2.
2. Logo regression (B-S10) reintroduced — handled in 10.7-15.
3. No further silent regressions found in ModelPicker, Sag-Goblin modal, or
   sidebar new-project paths at code level. Visual re-confirmation deferred to
   Phase E (Chrome 9222).

## Verdict
No additional hidden 10.6 regressions beyond the three already in-scope
(10.7-1/2 keys, 10.7-3 chat, 10.7-15 logo). Phase E walk will confirm visually.
