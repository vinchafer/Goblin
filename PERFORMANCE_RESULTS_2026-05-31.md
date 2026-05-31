# Performance Results — B9 / B10 (2026-05-31, Sprint 4 Phase 2)

Target: **cold-LCP < 2.5s** on the four marketing routes (`/`, `/terms`, `/help`, `/pricing`),
mobile-simulate. Also: CLS < 0.1, no TBT regression.

Tool: Lighthouse `--preset=perf --form-factor=mobile --throttling-method=simulate`, attached to
the running Chrome via `--port=9222`. JSON saved under `sprint-4/lighthouse/`.

## TL;DR
**All four routes already pass <2.5s LCP in real production.** The audit's "/ cold 3.5s" figure
came from Playwright hitting the **Next.js dev server** (on-demand compilation + unminified
bundles), which is not what users get. Measured against the live CDN, every route is well under
target with **CLS 0**. Font-loading optimizations were applied on top to widen the margin and cut
mobile bytes; they are committed for the next deploy.

## The measurement trap (why the audit number was misleading)
| Environment | home LCP | Dominant cost | Representative of users? |
|---|---|---|---|
| Dev server (`pnpm dev`), mobile-simulate | **3.2 s** | `server-response-time 1627ms` (dev SSR compile) + unminified JS/CSS + react-refresh | ❌ no |
| Local prod build (`next start`), mobile-simulate | **2.9 s** | local single-process TTFB ~558ms + render-blocking shared CSS | ⚠ partial (no CDN) |
| **Live production (CDN), mobile-simulate** | **2.0 s** | network + render delay | ✅ **yes** |

The dev server's `server-response-time` of **1.6 s** is pure compile latency that disappears in a
build. All four marketing routes are **`○ (Static)` prerendered** (confirmed in build output), so
in production they are served from Vercel's edge cache (warmed TTFB measured 0.28–0.49 s).

## Live production results (authoritative — currently deployed code)
| Route | LCP | FCP | CLS | TBT | Perf score | <2.5s? |
|---|---|---|---|---|---|---|
| `/` | **2.0 s** | 1.1 s | 0 | 570 ms | 0.85 | ✅ |
| `/terms` | **1.9 s** | 1.0 s | 0 | 420 ms | 0.89 | ✅ |
| `/help` | **1.6 s** | 1.0 s | 0 | 380 ms | 0.91 | ✅ |
| `/pricing` | **1.8 s** | 1.1 s | 0 | 410 ms | 0.90 | ✅ |

LCP element on `/` = the hero `<h1>` **text** (`main#main > section.hero > div.hero-inner > h1.hero-h1`)
— not an image. So the classic "hero image priority/AVIF" fix does not apply here; the lever is
render path (CSS + fonts), not image delivery.

## Changes applied (font loading — `apps/web/app/layout.tsx`)
Diagnosed via `render-blocking-insight` + `network-dependency-tree-insight`:

1. **Dropped unused Manrope weight 800.** Weights actually referenced in CSS/components are
   400/500/600/700 (verified by grep). 800 was declared but never used → one fewer self-hosted
   font file preloaded on every page.
2. **`preload: false` on JetBrains Mono.** Mono is only used on code/preview surfaces, never above
   the fold on marketing/auth. next/font preloads declared fonts by default; skipping mono stops
   it competing for bandwidth during first paint (helps 4G — Rajesh persona).
3. **Removed dead Google-Fonts preconnects.** `next/font/google` self-hosts fonts under
   `/_next/static/media`; the `<link rel="preconnect" href="fonts.googleapis.com/gstatic.com">`
   hints made connections that are never used.

Tooling: added env-gated `distDir` (`apps/web/next.config.ts`, defaults to `.next`) so a
production build can be measured in an isolated `.next-prod` dir **without disturbing the
founder's running `pnpm dev`**. Zero effect on dev/CI (env var unset → `.next`).

## Local prod build, before → after font changes (mobile-simulate)
| Route | LCP before | LCP after | CLS |
|---|---|---|---|
| `/` | 2.9 s | 2.8 s | 0 |
| `/terms` | 3.3 s | 3.0 s | 0 |
| `/help` | 2.5 s | 2.3 s | 0 |
| `/pricing` | 2.5 s | 2.3 s | 0 |

Deltas are modest and partly within single-run noise; the font changes reduce bytes/requests
without regressing CLS or layout (hero verified visually — `sprint-4/lighthouse/after-home-render.png`).
The local-prod absolute numbers remain inflated by single-process TTFB (~558 ms) that the CDN
removes — hence the live numbers above are the ones that count.

## What was tried but not pursued
- **Hero image priority / AVIF** — N/A: LCP element is text, not an image.
- **Server-component conversion** — TBT in production is already 380–570 ms (the dev TBT of
  1.2–1.9 s was a dev artifact). Not worth a structural refactor for marginal TBT under the
  9/10 "diagnose before fixing" bar.
- **Deferring shared CSS** — Next App Router auto-injects route CSS; manual deferral isn't safely
  available without risking FOUC. Render-blocking CSS cost (~486 ms local) is already absorbed
  under target on the CDN.

## Gate
- LCP < 2.5 s mobile-simulate on all 4 routes: ✅ (live: 1.6–2.0 s)
- CLS < 0.1 on all 4: ✅ (0 everywhere)
- No TBT regression: ✅ (prod TBT 380–570 ms, well within marketing tolerance)
- typecheck PASS ✅ · prod build PASS ✅ (exit 0)

## Founder note
The marketing-perf target is met in production today. The committed font changes are net-positive
(fewer bytes, fewer preloads) and will apply on the next deploy. If you want to chase the
remaining TBT on `/` (570 ms), the next lever would be trimming/deferring the landing page's
client-component JS — but it's below the priority bar for beta.
