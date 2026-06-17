# Goblin Model "(soon)" / not-selectable — Root-Cause Diagnosis (Session 5, Phase 0)

Date: 2026-06-17
Branch: master (deployed: f00fd66)
Scope: Why the Goblin-bundled models (Swift / Forge) render as "(soon)" and are
not selectable in the chat model dropdown, on the founder's account AND a fresh
account — while the backend reports `goblin_hosted` active.

> **No code was changed in Phase 0.** This document records the finding only.

---

## 0. Deployed flag values (as measured, not assumed)

| Flag | Environment | Value | How measured |
|---|---|---|---|
| `GOBLIN_HOSTED_API` | Railway (API) | **`true` / active** | `GET https://goblinapi-production.up.railway.app/health/deep` → `goblin_hosted: { status: ok, state: "active", enabled: true }` |
| `DEEPINFRA_API_KEY` | Railway (API) | present (key valid, invariant passes) | same health probe would report `misconfigured` if missing — it reports `active` |
| `NEXT_PUBLIC_GOBLIN_HOSTED_API` | Vercel (web) | **irrelevant to the chat picker** | the chat picker never reads it (see §2) — only `GoblinUsageBar` does |

So the backend is genuinely live. The break is entirely on the **read path** into
the dropdown: one web defect + one API gating defect.

---

## 1. Where the dropdown gets its options

`apps/web/components/app-shell/model-switcher.tsx` (the dashboard / standalone-chat
top-bar picker — this is the one the founder used; the code-pane
`SessionModelPicker.tsx` *hides* unavailable models entirely, so it can't be the
source of a visible "(soon)").

- It fetches `GET /api/models` (`model-switcher.tsx:69`).
- `/api/models` → `getCatalogForUser(userId)` (`apps/api/src/routes/models.ts:35`).
- The catalog adds the two Goblin tiers **only when the server flag is on**
  (`apps/api/src/services/catalog.ts:269-279`):
  ```ts
  if (isGoblinHostedEnabled()) {
    for (const tier of GOBLIN_HOSTED_TIERS) {
      const allowed = tierAllowedForPlan(tier, userPlan);   // ← RC-3
      push({ ... layer: 'goblin_hosted', available: allowed, badge: 'GOBLIN_HOSTED' ... });
    }
  }
  ```
- There is **no** static `goblin_hosted` entry in `config/providers.ts` and **no**
  data migration was done, so the catalog block above is the *only* source of the
  tiers. → **RC-2 (registry missing) is NOT the cause.** No DB/data migration is
  needed.

---

## 2. RC-1 (PRIMARY, web) — the "(soon)" text is hard-coded, flag-blind

`model-switcher.tsx` decides the badge and the group label for the
`goblin_hosted` layer **unconditionally**, ignoring both the flag and the API
`available` field:

- Badge — `model-switcher.tsx:248-250`:
  ```ts
  if (model.layer === 'goblin_hosted') {
    return { text: 'SOON', color: '#6b6560' }; // gray  ← always, even when live+available
  }
  ```
- Group label — `model-switcher.tsx:290`:
  ```ts
  hosted: "GOBLIN HOSTED — COMING SOON"          // ← always
  ```

Consequences:
- Every Goblin entry shows **"SOON"** and sits under a **"COMING SOON"** header,
  even though the backend is live and the catalog returns the tier.
- Selectability is a *separate* gate: `onClick={() => model.available && …}`
  (`:373`), with `opacity 0.45` + `cursor:default` when `!available` (`:378-379`).

→ This is the exact "backend active, UI shows (soon)" symptom the brief calls
RC-1 — but stronger: the picker **never consults** `NEXT_PUBLIC_GOBLIN_HOSTED_API`,
so flipping that Vercel env would NOT fix it. **The fix is code, not an env value.**
(The Vercel env should still be set `true` so `GoblinUsageBar` renders — it gates
on `GOBLIN_HOSTED_ENABLED`, `apps/web/components/usage/GoblinUsageBar.tsx:52` — but
that is independent of this bug.)

---

## 3. RC-3 (the selectability blocker, API) — plan-string gating excludes valid accounts

`apps/api/src/services/goblin-hosted.ts:140-143`:
```ts
export function tierAllowedForPlan(tier, plan): boolean {
  const p = (plan ?? '').toLowerCase();
  return tier.plans.includes(p);   // tiers list exactly ['trial','build','pro','power']
}
```

`available` for each Goblin tier is set to this predicate's result
(`catalog.ts:271`). It returns **`false`** for any plan value outside the exact
allowlist — i.e. `null` / `''` / legacy / `'free'`. With `available:false` the web
picker greys the row out and refuses the click (§2). The router applies the same
predicate and would refuse the stream (`model-router.ts:350-358`).

This contradicts the module's own documented intent — *"BOTH tiers are available
on EVERY plan … There is no model plan-gating any more … spend is governed by the
weighted allowance"* (`goblin-hosted.ts:97-101`, `model-router.ts:351-355`). The
real spend limits are enforced elsewhere (trial-gate middleware for expired trials;
`goblin-cap.ts` monthly allowance + daily guard in `streamCompletion`), so the
model picker has no business gating on the plan string.

The schema (`0033_plan_names.sql`) constrains `plan ∈ {trial,build,pro,power}` with
DEFAULT `'build'`, and the `?? 'free'` fallbacks in `users.ts:191` /
`support-agent.ts:74` are display-only — but any row where `plan` reads back as
`null`/empty (an unset or comped account, or a failed single-row read) lands on the
`false` branch and becomes unselectable. That is the most plausible reason the
founder's (older / comped) account is blocked, and the gate is brittle for every
account regardless.

---

## 4. Verdict

**Combination: RC-1 (web, the visible "(soon)") + RC-3 (API plan-gating, the
selectability blocker).** RC-2 is excluded — no registry/data migration needed.

### Fix (code only — no migration, no founder env required)
1. **Web** (`model-switcher.tsx`): derive the Goblin badge + group label from the
   API `available` flag instead of hard-coding "SOON". When a `goblin_hosted`
   model is `available`, render it as a normal selectable "inklusive · kein Key"
   option; only fall back to a neutral "soon" state when the API genuinely returns
   `available:false`. This makes the "(soon)" state impossible once the model is live.
2. **API** (`goblin-hosted.ts` / `catalog.ts`): stop gating Goblin-tier
   *selectability* on the plan string. Offer both tiers to every authenticated
   account whenever the flag is on (the documented intent); the monthly allowance
   (`goblin-cap.ts`) + trial-gate middleware remain the real spend/limit enforcers.

### Founder env note (optional, not blocking)
Set `NEXT_PUBLIC_GOBLIN_HOSTED_API=true` on Vercel so `GoblinUsageBar` shows. It is
**not** required to fix the dropdown (the picker doesn't read it).

### Untouched (HR-4)
The Layer-1 **free-pool** "Coming Soon" badge is a different surface
(`FREE_POOL_ENABLED`) and is left exactly as-is.
