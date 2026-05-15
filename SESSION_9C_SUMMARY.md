# Session 9C — Foundation Reset Summary

**Date:** 2026-05-14
**Duration:** ~1.5h (vs 4-5h Briefing-Estimate — viele Phasen waren bereits vorbereitet im Repo)
**Goal:** Bug-Fixes + Functional Foundations vor 9D-Polish
**Result:** 8/8 Phasen completed, build green, 0 typecheck errors

---

## What changed

| Phase | Bug | Fix | Files |
|---|---|---|---|
| 9C-1 | Mobile "+ New Project" → 400 "invalid project data" | COLORS hex statt CSS-vars | `apps/web/components/projects/new-project-modal.tsx` |
| 9C-2 | Landing 1 Plan vs Billing 3 Plans | Landing nutzt `GeoPricingSection` | `apps/web/app/page.tsx` |
| 9C-3 | Mobile-Sidebar slidet von unten | translateX(-100%)→0, top/left anchored, 85vw max 320px | `apps/web/components/layout/Sidebar.tsx` |
| 9C-4 | Recent Chats ohne Project-Badge | API joint `projects`, Badge `📁 Name` | `apps/api/src/routes/chat-sessions.ts`, Sidebar.tsx |
| 9C-5 | Workspace Tabs (Chat/Code/Preview) | Bereits in Header.tsx vorhanden, mobile via BottomTabBar | (kein Change nötig) |
| 9C-6 | Floating "?" überdeckt Send + Support antwortet nicht | SupportBubble entfernt, `/help` FAQ-Page | `dashboard-shell.tsx`, `Header.tsx`, `app/help/page.tsx` |
| 9C-7 | Footer cryptic "D X G" | Labels "Discord/Twitter/GitHub" als Pills | `landing/footer.tsx` |
| 9C-8 | Docs | BUG_REGISTRY + dieses Summary | `BUG_REGISTRY.md` |

## Repo-Realität vs Briefing — Notes

Briefing nahm an, vieles muss von 0 gebaut werden. Tatsächlich war im Repo schon viel da:
- `GeoPricingSection` mit 3 Plans + 3 Tiers existierte (nur Landing nutzte alte 1-Plan Section)
- Backend `geo-pricing.ts` mit Stripe-ENV-Variablen lag bereit
- Workspace-Tabs (Chat/Code/Preview) bereits in `Header.tsx` für Desktop und `BottomTabBar` für Mobile
- E2E-Setup gibt's noch nicht (per Vincent-Decision skipped, kommt 9D)

**Stripe Price IDs:** Backend liest aus ENV (`STRIPE_PRICE_BUILD_TIER1` etc.). Briefing's hardcoded IDs (`price_1TX0OfL...`) müssen in Stripe-Dashboard angelegt sein und als ENV-Variables gesetzt werden — ich habe sie NICHT im Code hardcoded.

## Manual QA Checklist (kein E2E in dieser Session)

Mobile (375×812 Chrome DevTools, fresh incognito):
- [ ] Login → tap Hamburger top-left → Sidebar slidet von LINKS, nicht von unten
- [ ] Sidebar zeigt: Logo "Goblin" / + New Project button / Projects / Recent Chats / User-Pill bottom
- [ ] User-Pill tap → öffnet `/dashboard/settings`
- [ ] KEINE "API Keys", "Billing", "Settings" Buttons mehr in Sidebar-Bottom-Row
- [ ] Tap "+ New Project" → Modal öffnet → Fill name → tap "Create project →" → Project entsteht (NICHT "Invalid project data")
- [ ] KEIN floating "?" Help-Button bottom-right mehr
- [ ] Recent Chats: chat in einem Project erstellen → Badge "📁 ProjectName" sichtbar im Sidebar-Listing

Desktop:
- [ ] `/` → Pricing-Section zeigt 3 Cards (Build/Pro/Power) mit Geo-Toggle
- [ ] Avatar-Dropdown im Header zeigt: API Keys / Billing / Settings / **Help & Support** / Sign out
- [ ] `/help` → 7 FAQ-Akkordeons + Email-CTA "support@justgoblin.com"
- [ ] Footer: "Discord / Twitter / GitHub" als Pills (nicht einzelne Buchstaben)

Build:
- ✅ `pnpm --filter @goblin/web build` green (kein error/warning)
- ✅ Typecheck (tsc --noEmit) sauber

## Known issues remaining → 9D

- Hero-Mockup abgeschnitten Desktop (>1280px) — needs container fix
- "Building with AI" Section schlecht designed — needs 3-col feature-grid
- "Island Flow" Boxen können auf mobile noch wrappen — `display: contents` mit `flex-wrap` ist OK aber nicht perfekt
- Settings-Sub-Pages, Profile-Page, iOS-Toggles, Usage-Bars (Briefing nennt diese explizit für 9D)
- E2E-Test-Setup (Playwright) komplett fehlend — 9D entscheidet ob lohnt

## Commits empfohlen

```
[PHASE-9C] fix(mobile): create-project color hex (resolves BUG-010)
[PHASE-9C] feat(landing): use GeoPricingSection (3 plans, geo-tiers, resolves BUG-011)
[PHASE-9C] feat(mobile): sidebar slides-from-left + user-pill (resolves BUG-012)
[PHASE-9C] feat(api): chat-sessions joins project_name + sidebar badge (resolves BUG-013)
[PHASE-9C] refactor(ui): remove SupportBubble, add /help FAQ page (resolves BUG-014, BUG-015)
[PHASE-9C] polish(footer): social labels not single letters
[PHASE-9C] docs: BUG_REGISTRY 9C update + session summary
```

(Vincent push'ed selbst per Mantra "kein manuelles Pushen" via Claude.)
