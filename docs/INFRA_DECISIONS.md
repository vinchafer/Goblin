# Infra Decisions

A log of infrastructure changes made outside the application codebase —
service removals, provider swaps, resource sizing — where the reasoning
and reversal path are worth keeping next to the code they affect.

---

## 2026-08-16 — Railway "litellm" service: deployment removed

**What was removed:** the deployment and public domain of the Railway
"litellm" service (`ghcr.io/berriai/litellm:main-latest`), in the Railway
project `fantastic-youthfulness`. The service shell and its environment
variables were **not** deleted — only the running deployment and its
public domain.

**Why:** `docs/LITELLM_DEPENDENCY_AUDIT.md` found zero live, unguarded
dependency on this service anywhere in the `vinchafer/Goblin` repo — every
code path that could reach it is gated behind `LITELLM_BASE_URL`, and the
founder confirmed that variable absent from the `@goblin/api` Railway
service's variables tab on this date (closing Honest Limitation #1 of
that audit). The service was running as pure cost: a ~700–800 MB RAM
baseline container serving no live traffic, at roughly $7/month.

**Evidence chain:**
1. `docs/LITELLM_DEPENDENCY_AUDIT.md` — verdict GREEN, full grep sweep
   and code-path analysis of the repo.
2. Founder-verified, 2026-08-16: `LITELLM_BASE_URL` confirmed absent from
   the `@goblin/api` Railway service variables (closes Honest Limitation
   #1 of the audit — this was previously inferred, not confirmed).
3. Post-removal regression probe: a real chat turn on production
   completed successfully after the litellm deployment was removed,
   confirming direct-SDK routing (OPTION B) works without the proxy
   present.
4. `@goblin/api` itself sits at roughly 200 MB RAM and is healthy; no
   memory tuning was applied to it as part of this change.

**Reversal path:** Railway → `litellm` service → **Deployments** tab →
**Redeploy** the last successful deployment. The service's environment
variables and Docker image configuration (`ghcr.io/berriai/litellm:main-latest`)
were preserved, not deleted, so a redeploy restores the service to its
prior running state without reconfiguration.

**Left untouched:** the second Railway project, `meticulous-adaptation`,
was deliberately left untouched by this change — it is unrelated to the
litellm decommission and out of scope for this decision.

**Open items (not resolved by this decision):**
- `docs/LITELLM_DEPENDENCY_AUDIT.md` Honest Limitations #2 and #3 —
  whether `infra/litellm/config.yaml`'s `model_list` was ever actually
  loaded into the live proxy, and the proxy's functional state since the
  June 2026 probe — remain open. This decommission does not resolve
  them; it only confirms the service was safe to remove regardless of
  the answer.
- A follow-up code PR to remove the now-fully-dead `validateKeyViaLiteLLM()`
  export, the unreachable `'litellm'` type options on `discovered_via` /
  `catalog_sync_log.source`, and the no-op `syncFromLiteLLM()` is proposed
  but not started — see the audit's findings-only section.
