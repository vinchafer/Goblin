# Onboarding Inventory (Phase 0, 6.3)

Canonical path: **`apps/web/app/welcome/*`**. No `app/onboarding/*` exists.
Verified by live local walk at 390x844 (preview-onboarding dev bypass set).

PDF deck (`sprint-10-5/MAX_WALK_SCREENSHOTS.pdf`): NOT present in this
environment (`/mnt/user-data/uploads` not accessible on Windows host). Page
refs from MAX_WALK kept as-is for the founder's copy.

## Step → file map (current: 5 steps)

| Step | URL | File | Title |
|------|-----|------|-------|
| 1 | `/welcome` | `app/welcome/page.tsx` | "How should Goblin talk to AI?" |
| 2 | `/welcome/provider` | `app/welcome/provider/page.tsx` | "Pick your AI provider" |
| 3 | `/welcome/routing` | `app/welcome/routing/page.tsx` | "Your build team is ready." |
| 4 | `/welcome/tools` | `app/welcome/tools/page.tsx` | "Give Goblin the right tools." |
| 5 | `/welcome/integrations` | `app/welcome/integrations/page.tsx` | "Plug Goblin into your stack." |

## Shared infra
- `app/welcome/layout.tsx` — font vars + wraps OnboardingChrome; imports `styles/onboarding-tokens.css`.
- `app/welcome/_components/chrome.tsx` — header (STEP 0n / 05 + pips), footer, returning-user guard (redirects to /dashboard if BYOK key exists). **Dev-only preview bypass added Phase 0** (localStorage `goblin:preview-onboarding=1`, dead when NODE_ENV=production).
- `app/welcome/_components/onboarding-state.ts` — GET/PUT `/api/onboarding/state`.
- `app/welcome/_components/icons.tsx` — inline SVG icons.

## Step-count plan (Sprint 10.5)
Add Step 0 (language) at front → 6 steps total. Chrome `STEP_BY_PATH` must add
`/welcome/language: 0` and display "/ 06"; pips array → 6 entries.

`STEP_BY_PATH` (chrome.tsx):
```
'/welcome': 1, '/welcome/provider': 2, '/welcome/routing': 3,
'/welcome/tools': 4, '/welcome/integrations': 5
```

## Routing notes
- Step 1 PATH B → `/welcome/provider?path=b`; PATH A → `?path=a`.
- "Explore first" link → `/dashboard`.
- Step 5 "Start building" → `/dashboard` (lands on Chat) — A-S11 must redirect to project-create.
- Step 3 "Change later" links → Settings/Routing (out-of-flow) — A-S6 removes.
