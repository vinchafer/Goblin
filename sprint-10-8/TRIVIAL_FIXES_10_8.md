# Sprint 10.8 — Trivial fixes & notes

## 10.8-3 hardcoded-model-slug grep audit
After making the catalog a cache + per-user discovery, grepped for hardcoded
model slugs in app code. Remaining occurrences are all **intentional** and kept:

- `apps/api/src/config/providers.ts` — this IS the documented last-resort static
  fallback used inside `getCatalogForUser` when DB cache is empty and a user has
  no discovery. Not a hardcoded catalog-of-truth.
- `apps/api/src/config/pricing.ts`, `apps/api/src/lib/model-pricing.ts` — cost
  reference tables keyed by slug. Needed for token-cost display, not catalog.
- `apps/web/components/chat/ChatInput.tsx:388` — DEFAULT_MODEL (Groq Llama 3.3
  70B). Intentional default recommendation per sprint §5.3 exception.
- `apps/web/app/dashboard/settings/routing/page.tsx` — routing preference
  defaults (curation).
- `apps/web/components/landing/sections/SendToCode.tsx` — marketing copy.
- `apps/web/lib/goblin-hosted-models.ts` — Phase-3 hosted config.
- `apps/api/src/lib/rankings/canonicalize.ts` — ranking name normalization.

Conclusion: no removal required. The catalog-of-truth (DB `models` table) is now
a cache synced from LiteLLM + intersected with per-user discovery.
