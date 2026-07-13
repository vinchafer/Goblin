# CW-2 — Back button instant response (evidence)

**Offender (DIAGNOSIS Part A, #1 — worst):** `standalone-chat.tsx:588-603`, the "← {projectName}" bar button. Two stacked defects: (i) no pressed state, (iii) `router.push` into a `force-dynamic` project route = cold RSC fetch, nothing paints on press.

**Fix — two layers, both cheap, both safe:**
1. **(i) is already resolved by CW-1** — the button is a plain inline `<button>` with no inline `transform`, so the new global `button:active { scale(0.97) }` now fires on press. Verified: `grep "transform" standalone-chat.tsx:588-603` → the button sets no inline transform.
2. **(iii) — warm the destination on mount** (`standalone-chat.tsx`, new effect after the chatProjectId effect):
   ```tsx
   useEffect(() => {
     if (projectId) router.prefetch(`/dashboard/project/${projectId}`);
   }, [projectId, router]);
   ```

**Why prefetch and NOT `router.back()` (deviation from D-S2 option A, chosen for correctness):** `router.back()` reuses the browser history entry, but the previous entry is not guaranteed to be the project page (deep-link, arrival from dashboard/sidebar, refresh) — it could land on the wrong page or leave the app. Prefetch keeps the **guaranteed** destination (`router.push` to the project) while removing the stall: Next.js warms the route's RSC + `loading.tsx` boundary, so the push paints the project skeleton **instantly**. This realizes D-S2's intent (instant back) without the back-stack risk — within the authorized cheap tier.

**Combines with CW-5:** CW-5 adds `app/dashboard/project/[id]/loading.tsx`. Prefetch + that boundary ⇒ the back tap shows the project skeleton on the same frame, then hydrates.

**Gate (deterministic):** effect present + keyed on `[projectId, router]`; destination string identical to the existing `onClick` push (`/dashboard/project/${projectId}`) → no semantic change, only warming. Full device "instant-feel" is founder-felt on deploy (cannot render a device here).

**Regression:** additive effect; the button's `onClick` is unchanged (still pushes the same route). Prefetch is a no-op when `projectId` is null (top-level chat).
