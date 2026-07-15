# U2 (F-34) — PWA icons: gold-on-green lockup, ALL sizes — evidence

## Source asset used
`apps/web/public/brand/logo/goblin-logo-primary.svg` — the full-bleed gold-on-green
lockup (green `#0F2B1E` rect + gold `#D4A737` g-mark, kept in FW3). The transparent gold
mark `goblin-logo-gold.svg` is used for the maskable safe-zone composite and the badge.
Rasterized deterministically with sharp via `scripts/gen-pwa-icons.mjs`.

## Generated (all real, not the prior ~400 B placeholders)
| file | size | purpose |
|---|---|---|
| icons/icon-192.png | 192² | manifest any |
| icons/icon-512.png | 512² | manifest any |
| icons/icon-192-maskable.png | 192² | manifest maskable (mark in ~66% safe zone) |
| icons/icon-512-maskable.png | 512² | manifest maskable |
| apple-touch-icon.png | 180² | iOS home screen (PNG — iOS ignores SVG apple icons) |
| icons/favicon-32.png / favicon-16.png | 32²/16² | PNG favicon fallbacks |
| icons/badge-72.png | 72² | notification badge (monochrome mark) |

## Wiring
- `apps/web/public/manifest.json`: any 192/512 + dedicated maskable 192/512 (was reusing
  the full-bleed 512 for maskable → clipped); badge purpose corrected to `monochrome`;
  `theme_color` aligned to the brand token `#1A3A2A` (was `#2D4A2B`).
- `apps/web/app/layout.tsx`: `icons.apple` now leads with the real 180 PNG (root cause of
  the plain-green home-screen icon — iOS ignored the SVG apple icon); PNG favicon
  fallbacks added; `mask-icon` fixed to the transparent gold-mark SVG (was a PNG).

## Reference audit
Every manifest + head icon reference resolves to a real file at the declared size
(verified, above). Rendered previews: `evidence/fw5-u2/icon-montage.png`.

## Honest limitation / founder action
The on-device home-screen look is the founder's eye. An already-installed PWA caches its
icons — the refreshed home-screen icon may require removing and re-adding the PWA to the
home screen (or an OS icon-cache refresh) after deploy.
