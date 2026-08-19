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
      "headline": "Dein Handy ist die Fernbedienung. Nicht der Server.",
      "size":     "sm",              // optional: smaller headline for long words
      "accent":   "„Die KI selbst läuft in Goblins Cloud.“",
      "footer":   "justgoblin.com",
      "badge":    "01 / 03"
    },
    {
      "template": "carousel-slide",  // numbered slide with body copy
      "surface":  "bone",            // optional: light slide (default is dark)
      "index":    "02 / 03",
      "eyebrow":  "So läuft es",
      "headline": "Nichts zu installieren.",
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
`post.json`.

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
