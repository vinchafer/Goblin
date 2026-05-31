# Landing-Page Button Audit + Wiring — Phase 2 (2026-05-31, Sprint 5)

Founder complaint: "sign-in button auf landing page funktioniert nicht … Start Building
funktioniert auch nicht — keine der buttons." Audited every CTA/link on `/`, wired the
conversion-critical ones, and fixed a middleware bug that was the **real** root cause for the
"Start building" button.

## Root cause (the important finding)
Two distinct defects:
1. **Dead `href="#"`** on every primary CTA — Nav "Sign in" + "Start building", Hero, Outro,
   and all 3 Pricing cards. Clicking did nothing (anchor to current page).
2. **Middleware guarded `/register` as protected** (`apps/web/middleware.ts`). The public
   allowlist listed `/signup` (a route that doesn't exist) but **not** `/register` (the route
   that does). So even after wiring "Start building" → `/register`, an unauthenticated user was
   307-bounced to `/login?redirect=%2Fregister` — the page's own `redirect('/login?mode=signup')`
   never ran. Fixed by adding `pathname === '/register'` to the allowlist.

## Wiring applied (canon)
| Element | File | Was | Now | Dest status |
|---|---|---|---|---|
| Nav "Sign in" | Nav.tsx | `#` | `/login` | 200 |
| Nav "Start building" | Nav.tsx | `#` | `/register` → `/login?mode=signup` | 200 |
| Nav Lockup (home) | Nav.tsx | `#` | `/` | 200 |
| Hero "Start building free" | Hero.tsx | `#` | `/register` | 200 |
| Hero "See how it works" | Hero.tsx | `#how` | `#how` (anchor, kept) | n/a |
| Outro "Start building free" | Outro.tsx | `#` | `/register` | 200 |
| Pricing "Start free trial" ×3 | Pricing.tsx | `#` | `/register` | 200 |
| Footer Terms | Footer.tsx | `#` | `/terms` | 200 |
| Footer Privacy | Footer.tsx | `#` | `/privacy` | 200 |
| Footer Imprint | Footer.tsx | `#` | `/imprint` | 200 |
| Footer Pricing/FAQ | Footer.tsx | `#pricing`/`#faq` | kept (anchors) | n/a |
| Middleware allowlist | middleware.ts | `/register` guarded | `/register` public | — |

Verification: rendered HTML of `/` now contains `href="/login"`×1, `href="/register"`×6,
legal×3. All destinations return HTTP 200. Browser confirms `/register` → `/login?mode=signup`
(mode=signup active). Screenshots: `sprint-5/landing-buttons/`.

## Deferred (documented, not wired — no destinations exist)
These are secondary footer links with **no built page**. Not wired to avoid inventing routes or
gutting footer columns (founder design territory). Remain `href="#"`:
- Footer socials: Discord, Twitter, GitHub (no public URLs decided)
- Footer Product: Changelog
- Footer Company: About, Manifesto, Press

**Founder decision needed:** build these marketing/legal-adjacent pages, or remove the links.
Recommendation: drop the Company column + Changelog for beta (they imply depth that isn't there);
add a real GitHub URL when the repo goes public.

## Gate
- All primary conversion CTAs reach intended destination (200) ✓
- Middleware `/register` guard bug fixed ✓
- No 404s on wired links ✓
- typecheck: see commit (run pending at write time)
