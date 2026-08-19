# Profile avatar — Instagram / TikTok

Rendered from the authored brand SVGs in `branding/icons/`. The mark is **not**
redrawn here and the padding is **not** re-cropped — the whole source SVG is
scaled into the output box, so the authored inset is preserved byte-for-byte in
geometry terms.

## Files

| File | Source | Field | Use |
|---|---|---|---|
| `avatar-green-1000.png` | `branding/icons/app-icon.svg` | Brand Green `#1A3A2A` | founder's requested gold-on-green |
| `avatar-inkdeep-1000.png` | `branding/icons/app-icon-dark.svg` | Ink Deep `#0F2B1E` | design-system §B1.1 primary tile |
| `avatar-green-40.png` | downscale of the above | — | legibility probe (story-ring size) |
| `avatar-inkdeep-40.png` | downscale of the above | — | legibility probe (story-ring size) |

All four are 8-bit sRGB PNG, **colour type 2 — no alpha channel**. Instagram
composites transparency unpredictably, so the rounded corner authored in the
source SVG (`rx="230"`) is flattened into the field colour: the shipped square
is full-bleed, and the platform's own circular crop supplies the rounding.

The 40 px files are a *downscale of the shipped 1000 px raster*, not a fresh
rasterisation of the vector at 40 px. That is what the platform actually does,
and it is the only version of the probe that can tell you anything.

## Spec divergence — founder decision pending

`GOBLIN_DESIGN_SYSTEM.md` §B1.1 names **Ink Deep** as the *primary* tile for the
app icon and the social avatar, with Brand Green as the *in-product* field. The
founder asked for gold-on-green. Both are rendered; neither is chosen here.

## Regenerate

```
node content/social/profile/render-avatar.mjs
```

Output is deterministic — same input, byte-identical PNGs. The script asserts
the dimensions, the absence of an alpha channel, and that both corners carry the
field colour; it exits non-zero rather than writing a wrong avatar.
`render-report.json` is the machine-readable record of the last run.
