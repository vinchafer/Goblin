# Tester-feedback wave — evidence (2026-08-17)

Regenerate with:

```
PW_CHROMIUM_PATH=<chrome> pnpm --filter @goblin/web exec tsx scripts/tester-wave-shots.mts evidence/tester-wave-2026-08-17
```

## What these artifacts prove — and what they don't

The PNGs are rendered from the **real production components** (`components/layout/Header.tsx`,
`components/app-shell/bottom-tab-bar.tsx`) and the **real token files**
(`styles/design-tokens.css`, `styles/dashboard-tokens.css`), inside the product's own demo
choke point so no credentials are involved.

**They prove markup and colour.** They do **not** prove behaviour: there is no server, no
session and no data behind them. A live authenticated walk needs credentials this session
does not have, so it is on the founder-action list instead of being implied here.

## U2 — the preview surfaces are gone

| file | width | theme | lang |
|---|---|---|---|
| `tabs-desktop-{light,dark}-{de,en}.png` | 1280 | both | both |
| `tabs-phone-{light,dark}-{de,en}.png` | 375 | both | both |

The header pills read **Chat · Code**; at 375px the header collapses to its mode dropdown
and the bottom bar reads **Chat · Code**. The toolbars close up — no gap where the third
tab was, no "coming soon" stub.

The `.txt` beside each PNG is the rendered DOM text. `grep -il "preview\|vorschau" *.txt`
returns nothing: the proof is in a form that can be checked without looking at pixels.

Each frame also carries the U1 truncation notice in the real copy (DE and EN, from
`lib/truncation-copy.ts`) — it is the one new user-facing string of this wave.

## U3 — dark contrast, before and after

`contrast-dark.png` is the audit made visible: left column uses the token values as they
were before this wave, right column as they are now, on identical surfaces. The pale
cream and pale blue blocks on the left — with white text nearly invisible on them — are
the defect class the tester screenshotted.

`contrast-light.png` is the same board in light mode, where nothing changed.

`contrast-table.md` is the numeric audit: 40 pairs, 19 failing before, 0 failing after.
The same matrix runs as a test in `apps/web/styles/dark-contrast.test.ts`, so it keeps
failing if a token drifts back.
