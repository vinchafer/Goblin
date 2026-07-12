# L1 · F-01 — Stray bar above the logo at scroll-top

## Diagnosis (diagnosis-first)
At scroll-top on the landing page, a thin dark-green (`rgb(15,43,30)`) bar/strip
rendered at the very top-left, above the Goblin logo. It is **not** a
sticky-header scroll-class artifact — the `.lp-nav` is a plain `position: fixed`
server component with no scroll state.

Root cause: the visually-hidden skip link (`a.skip-link` in `app/page.tsx`)
was hidden with a fixed offset:

```css
.landing-root .skip-link { position: absolute; top: -40px; left: 8px;
  background: var(--green); ... padding: 8px 14px; z-index: 200; }
```

The element renders **~44px tall on a mobile (375px) viewport** (mobile
`text-size-adjust` inflates the font relative to desktop), so `top: -40px`
left a **~4px dark sliver protruding below the top edge** (−40 + 44 = +4).
Its `z-index: 200` placed it above the nav (`z-index: 100`), so the sliver
showed at scroll-top. It manifests at 375px; on desktop the shorter render
(≈36px) stayed fully hidden — which is why the founder saw it on the mobile
production walk.

## Fix
Hide the skip link with a **height-independent** offset — `top: 0` +
`transform: translateY(-100%)` — so it is fully off-screen regardless of its
own rendered height, and drops to `translateY(8px)` on `:focus`.
File: `apps/web/styles/landing.css`.

## Evidence (local build, `next dev`, deviceScaleFactor 2)
- `before-mobile-scrolltop.png` — sliver visible above the logo (375px, fresh scroll-top).
- `before-desktop-scrolltop.png` — no sliver on desktop (bug is mobile-manifesting); header baseline.
- `after-mobile-scrolltop.png` — sliver gone (375px).
- `after-desktop-scrolltop.png` — clean (desktop).
- `after-desktop-scrolled.png` — header correct when scrolled.
- `after-skiplink-focus.png` — skip link still appears on keyboard focus (a11y preserved: top 8px, visible).

DOM probe confirms: before → `elementFromPoint(12,2)` = `a.skip-link`
(`rgb(15,43,30)`); after → `nav.lp-nav`. Focus test → skip link at top:8, visible.
