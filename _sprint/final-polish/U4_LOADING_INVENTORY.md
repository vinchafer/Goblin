# U4 — every loading surface, before and after

**Founder evidence (prod, installed PWA):** "es gibt mehrere verschiedene Ladeschirme …
sieht extrem unprofessionell aus" — sometimes a small gold mark, sometimes the large green
one, and sometimes a jump from gold to green mid-load.

## What was actually there

Six independently written loading states, each with its own colour and size. That is the
whole cause: navigate from one to the next and the mark changes under you.

| # | Surface | File (before) | Mark | Size | Copy | After |
|---|---|---|---|---|---|---|
| 1 | Root route splash (every route transition) | `app/loading.tsx:14` | green | **64** | "Workspace wird geladen" — **DE only** | `PageLoading context="workspace" fill="viewport"` |
| 2 | Projects list | `app/dashboard/projects/page.tsx:107` | green | **32** | none | `PageLoading context="projects"` |
| 3 | Chats list | `app/dashboard/chats/page.tsx:102` | green | **32** | none | `PageLoading context="chats"` |
| 4 | New-chat redirect page | `app/dashboard/chat/page.tsx:38` | green | **36** | none | `PageLoading context="chat"` |
| 5 | Code workspace | `components/code/CodeWorkspace.tsx:213` | green | **28** | none | `PageLoading context="code"` |
| 6 | Chat history load (project chat) | `components/workspace/chat-tab.tsx:236` → `GoblinLoader variant="thinking"` | **GOLD** | 24 | "Your goblin is thinking…" — **EN only** | `PageLoading context="chat"` |
| 7 | `GoblinLoader variant="page"` (library) | `components/ui/GoblinLoader.tsx:79` | green | 32 | the word "Goblin" | deleted — delegated, then removed (no consumers) |

**Where the gold→green jump came from:** #1 (green, 64) paints on the route transition;
#6 (gold, 24) paints as soon as the project chat mounts and starts loading history. Two
different marks, one navigation.

**Second offender, same shape:** #1 vs #2/#3/#4/#5 — all green, but 64 → 32 → 36 → 28.
The founder named this himself: the green one is right, "vor allem seine Grösse".

## After

One component: `components/ui/PageLoading.tsx`.

- One mark, one size (`PAGE_LOADING_MARK_SIZE = 64`), one colour.
- An optional context line, because "Workspace wird geladen" is not true on the chats
  list. Seven contexts, each DE **and** EN.
- `fill="viewport"` for a route splash, `fill="region"` for a pane — same visual either
  way, which is the point.

`GoblinLoader` is **deleted**, not merely bypassed: after #6 and #7 moved it had no
consumers left, and its default variant was the gold one.

## The dark-mode bug the renders caught

Worth recording, because it was invisible in code review and obvious the moment the
screen was actually rendered.

The mark used `variant="green"` → `--brand-green` (#1A3A2A). That is the **locked brand
anchor**: it never flips. On `--surface-page`, which in dark is #133224, the mark was
dark green on dark green — all but invisible. `app/loading.tsx` already had this bug, so
in dark mode the founder's "large green one" was barely there too.

`design-tokens.css` warns about exactly this at `--brand-fg` ("use `--brand-fg` wherever
brand green was a FOREGROUND; keep `--brand-green` for fills") — it is the FIX-WAVE-3
defect class recurring. `GoblinLogo` gained a `brand` variant → `var(--brand-fg)` (brand
green in light, sage in dark) and `PageLoading` uses it. The `green` variant stays for
fills. `PageLoading.test.ts` now fails if a loading screen reaches for the anchor again.

## Evidence

`evidence/final-polish/page-loading-{light,dark}-{de,en}.png` — the real component
rendered (`renderToStaticMarkup`, not a mock-up) at **375px**, all seven contexts, both
themes. Regenerate with:

```
pnpm --filter @goblin/web render:loading      # writes the HTML sheets
```

then screenshot them (the PNGs in `evidence/` were taken with Playwright/Chromium at
375px, deviceScaleFactor 2, breath animation paused for determinism).

**Honest note on the two language sheets.** `useLang()` resolves on an effect, which does
not run under `renderToStaticMarkup`, so a static render is always the German default. The
EN sheet substitutes the caption using the component's own exported `CONTEXT_COPY`, so both
sheets show real strings from the one source of truth — but the EN sheet is a substitution,
not an independent render. What the images prove is the thing the founder reported (one
mark, one colour, one size, no jump), which is language-independent; the DE/EN strings
themselves are asserted in `PageLoading.test.ts`.

## Deliberately not changed

The small **gold** marks that sit inline inside working UI — the "Stoppen" button
(`SessionPromptInput.tsx:90`), agent step rows (`AgentRunView.tsx:163`), the build-status
pill (`SessionPane.tsx:1068`), the session history pill. Those are activity indicators
beside text, not loading screens, and gold is their established brand use. Changing them
is a design decision that belongs to the founder, not a drive-by in a polish wave.

## Correction to the wave prompt (Gesetz 10 — repo over prompt)

The prompt asks to "remove every remaining use of the **old gold logo asset** (grep-proof,
like the earlier logo sweep)". **There is no old gold asset.** `gold` and `green` are
colour variants of the *same* inline mark in `GoblinLogo.tsx` — one `G_MARK_PATH` rendered
with `fill="currentColor"`, coloured by a CSS variable. The earlier sweep evidently already
removed the legacy files. So the grep-proof delivered here is a proof about **variant use
on loading surfaces** (`PageLoading.test.ts`: no loading surface matches
`variant="gold"`, and `GoblinLoader.tsx` no longer exists), not about a file on disk.

## Not covered here

The **PWA cold-start splash**. `manifest.json` sets `background_color: #F7F4ED` (light
cream) with no `apple-touch-startup-image`, so an installed PWA opening in dark mode
flashes a light background before the app paints. That is a real first-impression seam,
but changing it is a brand/design decision (and iOS startup images are per-device assets),
so it is reported, not decided. `manifest.json` also hard-codes `"lang": "en"` — related to
the U7 language items.
