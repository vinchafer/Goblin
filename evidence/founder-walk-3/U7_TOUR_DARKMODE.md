# U7 — First-run tour, dark-mode re-verification (rendered + contrast re-run)

The #54 tour-contrast fix (flip-aware `--panel` / `--text` / `--meta` / `--brand-fg`
tokens replacing the hard-coded `#fff` card) could not be tested on-device by the
founder. This wave re-verifies it with BOTH a re-run computed-contrast table and a
rendered dark-mode screenshot of every step.

## Rendered evidence
`u7-tour-dark.png` — all 3 tour steps over a dark dashboard backdrop:
1. 📁 "Hier leben deine Projekte"
2. ✦ "Vom Chat in den Code" ← the founder's previously unreadable pale-on-pale title, now clean white
3. 📊 "Behalte deinen Verbrauch im Blick"

Every element legible: white titles, sage/meta body, gold "Weiter / Los geht's"
button on green, sage progress bar. Harness: `u7-tour-dark-harness.html`.

## Contrast table (re-run, DARK mode — `node evidence/founder-walk-3/u7-tour-contrast.mjs`)
Card surface `--panel` = `#08170F`.

| Element | Colors | Ratio | Requirement | Verdict |
|---|---|---|---|---|
| Step title (`--text` on card) | `#FBF7EC` / `#08170F` | **17.21:1** | AA 4.5 | PASS |
| Step body (`--meta` on card) | `#968768` / `#08170F` | **5.23:1** | AA 4.5 | PASS |
| Skip link (`--meta` on card) | `#968768` / `#08170F` | **5.23:1** | AA 4.5 | PASS |
| Next button label (`--brand-gold` on `--brand-green`) | `#D4A737` / `#1A3A2A` | **5.58:1** | AA 4.5 | PASS |
| Progress filled (`--brand-fg` sage on card) | `#7FA98A` / `#08170F` | **6.97:1** | UI 3.0 | PASS |
| Close × (`--meta` on `--div`-over-card) | `#968768` / `#16241C` | **4.57:1** | UI 3.0 | PASS |

**6/6 element classes pass** (across all 3 steps: title×3, body×3, skip×3, next×3,
progress, close — every distinct color pairing above).

## No code change
The tour code was fixed in #54 and is unchanged here — this unit is verification
only (rendered proof + re-run contrast), as the wave requested.

## Honest limitation
Contrast is computed from the shipped token values; the render is a faithful
token-accurate model (real dark-mode hex). The exact on-device dark rendering
(true iOS PWA dark theme, sub-pixel AA) is the founder's re-walk — but the numbers
are the shipped colors and clear AA on every text element, so there is nothing
pale-on-pale left to surprise him.
