# PWA icon fix — flat gold mark, calm sizing, no 3D effect

**One unit · one commit · corrects the visual execution of FW5-U2 (F-34, shipped at `7207f4d`).**
Branch `claude/pwa-icon-flat-gold-mark-f6ye8b`.

## Founder's two defects → what changed

1. **Too large** — the shipped "any" icons + apple-touch rendered the mark *full-bleed*
   (`fit: 'cover'` on `goblin-logo-primary.svg`), so the mark filled ~86% of the tile
   (horns at the top edge, foot near the bottom). Under the iOS corner mask this crowded
   the tile and read heavy. **Fixed:** every tile is now a flat green square with the mark
   **composited centered at ~63% of the tile width** (~68% tall — the mark is taller than
   wide), so there is even margin all around and the horns sit well clear of the mask.
2. **"3D / hervorkommen"** — investigated at source. The mark source
   `apps/web/public/brand/logo/goblin-logo-gold.svg` is **already a single flat
   `fill="#D4A737"` path** — grep for `filter|feGaussianBlur|feDropShadow|feOffset|
   linearGradient|radialGradient|stop-color|opacity=` returns **0**. There is **no bevel,
   emboss, gradient or shadow in the source to strip.** The "pops out / 3D" impression came
   from the oversized full-bleed crop pressed against the rounded mask edge, not from any
   effect. Calming the size to a centered ~63% removes that tension; the fill is and stays
   flat gold on flat green `#0F2B1E`.

## Composition (spec met)

- **Background:** flat deep green `#0F2B1E`, full-bleed to the square edge — no inner border,
  ring, or lighter edge. The OS applies its own rounding.
- **Mark:** flat brand gold `#D4A737`, single flat fill — no bevel / emboss / shadow / gradient.
- **Sizing / safe zone:** mark trimmed to its true bounding box (the 570² viewBox carries
  ~20%/14% transparent padding), then sized to **~63% tile width, centered**. Well inside the
  maskable inner-80% safe zone. `any` and `maskable` are now identical calm composites.

## Deliverables (all regenerated deterministically — `scripts/gen-pwa-icons.mjs`, no network/random)

| file | size | purpose | mark width |
|---|---|---|---|
| `icons/icon-192.png` | 192² | manifest any | ~63% |
| `icons/icon-512.png` | 512² | manifest any | ~63% |
| `icons/icon-192-maskable.png` | 192² | manifest maskable (safe-zone) | ~63% |
| `icons/icon-512-maskable.png` | 512² | manifest maskable | ~63% |
| `apple-touch-icon.png` | 180² | iOS home screen — **PNG** (iOS ignores SVG apple icons; the FW5 root-cause fix is kept) | ~63% |
| `icons/favicon-48.png` | 48² | favicon PNG fallback | ~68% |
| `icons/favicon-32.png` | 32² | favicon PNG fallback | ~74% |
| `icons/favicon-16.png` | 16² | favicon PNG fallback | ~74% |
| `favicon.ico` | 16+32+48 | classic `/favicon.ico` (PNG-in-ICO) — **new** | 74/74/68% |
| `icons/badge-72.png` | 72² | notification badge, gold-on-transparent (Android tints) | ~72% |

**Favicon judgment (noted per spec):** at 16/32/48 px the mark is scaled up (68–74% vs 63%)
so the silhouette stays legible at tiny sizes; see the favicon rows in the previews sheet.

## Evidence (open the images — this is the gate)

- `previews-and-mask-sim.png` — **every** generated icon at actual render size **+** an iOS
  rounded-corner (`rx≈22.37%`) mask simulation. Every mark sits clear of the clip.
- `before-after.png` — shipped (large, edge-touching) **vs** new (calm, centered) for
  icon-512 any, icon-512 maskable, and apple-touch-180 — raw and masked.
- `AFTER-*.png` / `AFTER-favicon.ico` — the shipped new assets, copied for the record.
- `BEFORE-*.png` — the FW5-shipped assets, snapshotted before regeneration.

## Reference audit

All 15 manifest + `<head>` icon references resolve to real files at their declared sizes
(verified with `sharp().metadata()`): manifest any/maskable/badge, apple-touch 180,
PNG + SVG favicons, the two app icons, the new `favicon.ico`, and the Safari `mask-icon`
(`goblin-logo-gold.svg`). `layout.tsx` gains one line: the `/favicon.ico` fallback.

## Honest limitations

- **On-device rendering cannot be verified headlessly.** The mask simulation is a rounded-rect
  approximation of the iOS squircle, not the device compositor. The real gate is the founder's eye.
- **iOS caches home-screen icons aggressively.** An already-installed PWA will keep the old
  (large) icon until it is **removed and re-added** to the home screen (or the OS icon cache
  refreshes) after this deploys. This is the founder action below.
- The **SVG favicons** (`brand/icons/goblin-*.svg`, rendered first in modern browsers) were left
  unchanged — they are already flat single-fill and appropriately sized for tiny display; only the
  PNG/ICO raster fallbacks were regenerated.
- No token/API/consumption path is touched (static assets only) → no `GOBLIN_CONSUMPTION_LEDGER.md`
  entry required.

## Founder action

After deploy, **remove the Goblin PWA from the home screen and re-add it** to refresh the cached
icon, then check the on-device look — that is the real acceptance gate.
