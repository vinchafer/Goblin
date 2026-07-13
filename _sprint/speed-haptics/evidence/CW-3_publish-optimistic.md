# CW-3 — Publish optimistic before pre-check (evidence)

**Offender (DIAGNOSIS Part A, #5):** `SessionPane.tsx:552-562` (`liveStellen`). After the confirm, the handler did `await apiGet('/api/integrations/vercel')` **before** any `setDeploying(true)` / `setPublishStream(...)` — so after confirming publish there was **no visual feedback until that round-trip returned** (dead on a slow link).

**Fix:** move the optimistic publishing state to fire on the **same tick as the confirm**, before the pre-check:

- BEFORE: `setDeployConfirm(false)` → `await apiGet(vercel)` → `setDeploying(true)` / `setPublishStream(...)`.
- AFTER: `setDeployConfirm(false)` → `setDeploying(true)` + `setPublishStream({phase:"publishing", message:"Wird vorbereitet …"})` → `await apiGet(vercel)` → (not-connected ⇒ **revert** `setDeploying(false)`/`setPublishStream(null)` then open JIT) → continue.

**Honesty (Feeling-invariant 6 — "nie eine nicht-erfolgte Aktion behaupten"):** the pre-check copy is **"Wird vorbereitet …"** (being prepared), which is true — we are checking the connection. It does **not** claim "gesichert" or "veröffentlicht". The truth-gated flip to `phase:"live"` still happens **only** on the server success event (`SessionPane.tsx:582`, unchanged) — the server-side `verifyDeployment` gate is untouched.

**Not-connected path stays clean:** the new `setDeploying(false); setPublishStream(null)` before `setVercelJit(true)` ensures the connect JIT is never shown behind a phantom publishing stream (a regression the naive reorder would introduce).

**Gate (deterministic):** diff shows `setDeploying(true)` now precedes the `apiGet` line; the not-connected branch reverts both states. No change to the success/truth-gate path.
