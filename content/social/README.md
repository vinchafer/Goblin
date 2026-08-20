# Social post renderer

Instagram graphics, rendered from the repo's own design system. No Canva, no
font upload, no colour picked by hand — the templates read
`apps/web/styles/design-tokens.css` and the fonts vendored in `fonts/`, so a
post cannot drift from the product.

---

## Quickstart — the whole thing is two steps

**1 · Copy a post folder and edit one file.**

```
cp -r content/social/posts/ausfuehrungsmodell content/social/posts/mein-post
```

Open `content/social/posts/mein-post/post.json`. It is the only file you touch.
Change the text. Delete slides you don't want. That's it.

**2 · Render it.**

```
node content/social/render.mjs content/social/posts/mein-post
```

Every slide comes out twice — **1080 × 1350** for the feed and **1080 × 1920**
for a story — into the same folder, ready to send to your phone.

**No dependency of its own.** The renderer resolves Playwright from whatever
this repo (or your machine) already has — `@playwright/test`,
`@playwright/core` or a plain `playwright` install — via Node's CommonJS
resolution, which walks `node_modules` *and* honours `NODE_PATH`. If none of
those are installed where you're running from, either run `pnpm install` at
the repo root, or point `NODE_PATH` at a directory containing one (see
`lib/browser.mjs`).

If the browser binary Playwright resolves to doesn't match what's actually on
disk — a CI or sandbox image that ships a Chromium revision older than the
pinned `@playwright/test` expects, for instance — set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` to the binary's path and the renderer
launches that instead of asking Playwright to download a matching one:

```
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium \
  node content/social/render.mjs content/social/posts/mein-post
```

Unset, rendering behaves exactly as before.

**On your phone**, tell a Claude Code session:

> Neuer Instagram-Post: kopiere `content/social/posts/ausfuehrungsmodell` nach
> `content/social/posts/<name>`, setze diesen Text ein, rendere und pushe.

The renderer refuses to write anything that is broken (see *The gates* below),
so what lands in the folder is safe to post.

---

## post.json

```jsonc
{
  "title": "Ausführungsmodell",
  "slides": [
    {
      "template": "type-post",       // typography only
      "eyebrow":  "Ausführungsmodell",
      "headline": "Dein Handy ist die Fernbedienung.\nNicht der Server.",
      "size":     "sm",              // optional: smaller headline for long words
      "accent":   "„Die KI selbst läuft in Goblins Cloud.“",
      "footer":   "justgoblin.com",
      "badge":    "01 / 03",
      "mark":     false              // optional: opt this slide out of the logo mark
    },
    {
      "template": "carousel-slide",  // numbered slide with body copy
      "surface":  "bone",            // optional: "bone" (light) or "green" (Brand Green, dark)
      "cover":    true,              // optional: the carousel's opening beat — see below
      "index":    "02 / 03",
      "eyebrow":  "So läuft es",
      "headline": "Nichts zu\ninstallieren.",
      "body":     "Goblin auf dem Homescreen ist die Werkstatt …",
      "footer":   "justgoblin.com"
    },
    {
      "template": "screenshot-frame",// a screenshot in a phone frame
      "eyebrow":  "Im Produkt",
      "headline": "Anmelden, und weiterbauen.",
      "image":    "evidence/public-i18n/shots/login-375-de-light.png",
      "caption":  "Von jedem Gerät aus einloggen.",
      "footer":   "03 / 03 · justgoblin.com"
    }
  ]
}
```

Leave a field out and it simply disappears from the slide — no gap, no
placeholder. `image` is a path from the repo root, or a file sitting next to
`post.json`. The one field this doesn't apply to is `mark`: an *absent* `mark`
key means "use the surface default"; only `"mark": false` turns it off (a
string still overrides which file renders — see **The mark** below).

### Authored line breaks

`headline` (and `accent`) honour a literal `\n` in the JSON string as a hard
line break — not a suggestion the layout is free to re-wrap. Write
`"headline": "Was ist\nGoblin?"` and it breaks exactly there, every time, on
every format. This is plain CSS `white-space: pre-line` on `.headline` /
`.accent` in `_base.css`: textContent already preserves the `\n` character
untouched, `pre-line` is what stops the browser from collapsing it to a
space. `text-wrap: pretty` still governs any *soft* wrap inside one authored
line (a line too long for the column), but it never reflows across an
authored break — balanced auto-wrap is not an acceptable substitute for
headline typography that has actually been set by hand.

Slides without an authored `\n` fall back to ordinary wrapping, exactly as
before.

### The mark

Every template that carries the logo (`carousel-slide`, `screenshot-frame`,
`type-post`) shows it by default — gold on a dark or green field, ink on
`bone` (`defaultMark()` in `render.mjs` picks the right one; gold on a light
field is never allowed). Set `"mark": false` on a slide to opt it out
entirely — useful for a slide that wants to be nothing but a single line of
type with no chrome at all. A string (a path from the repo root) still
overrides which file renders, same as before.

### Cover slides (carousel-slide only)

Set `"cover": true` on a carousel-slide slide to mark it as the carousel's
opening beat rather than a numbered body card: the headline renders at full
display size (the `headline--sm` step used by body slides is stripped),
centred, with more air above and below. Give a cover slide an `eyebrow`
instead of an `index` — the two conventions (eyebrow vs. gold index chip) are
what make a cover and a body slide read as visibly different card types
instead of five identical cards in a row.

### Surfaces

`surface` accepts `"bone"` (light, warm cream) or `"green"` (Brand Green,
still a *dark* field — the on-dark inks carry over unchanged). Leave it out
for the default `ink-deep` dark field. `green` exists specifically so a
carousel's cover slide can read as a distinct beat from its ink-deep body
slides without leaving the dark palette.

---

## The rules, already enforced

You do not have to remember these. The renderer does.

- **Colour** comes only from the design system. There is not one hex value in
  the templates.
- **Type** is Manrope, Instrument Serif (italic, accent only) and JetBrains
  Mono, loaded from `fonts/` in this repo. Nothing is fetched while rendering.
- **Gold is a filled surface** — the badge, the slide number. Never gold text,
  never a gold border, and on the light `bone` slide even the logo switches to
  ink.
- **No emoji.**

---

## The gates

`render.mjs` checks the slide before it writes it, and writes **nothing** if a
check fails. The previous PNGs stay where they are.

| Gate | What it catches |
|---|---|
| Font | A slide that silently rendered in a fallback font. Four separate proofs, including asking Chromium which font it actually painted the glyphs with. |
| Contrast | Any text/background pair under §A2.5 — 4.5:1 body, 3:1 large. |
| Layout | Text outside the canvas, elements sitting on top of each other, a word too long for its column. |
| Network | Any attempt to fetch something from outside this repo. |
| Geometry | A design token that moved under us and would silently reflow every post. |

When a render fails it tells you which slide, which check, and the number. The
usual one is a headline that is too long:

```
01-type-post/feed: LAYOUT "Dein Handy ist die Fernbe…" runs 83px wider than
its column at 130px — shorten it, or set "size": "sm" on the slide
```

---

## Evidence

`node content/social/render.mjs --probe` renders two slides carrying all three
type families and the German set `Größe · Anmeldeseite · fünf`, `ä ö ü ß`,
`„ ‚ “ ”`, into `probe/`. Open them and you can see for yourself that the real
faces rendered. `probe/render-report.json` has the numbers.

The same command is the fastest way to check the fonts still work after anyone
touches `fonts/` or the design tokens.

---

## Related

- `profile/` — the Instagram/TikTok profile picture, and how to re-render it.
- `fonts/` — the vendored families, their SHA-256 manifest and their OFL
  licences. `fetch-fonts.mjs` re-downloads them.
- `templates/_base.css` — the only stylesheet; read the header comment before
  changing anything.
