# §03 fidelity — mock rebuilt to mirror the REAL product verbatim

The §03 chat + editor mock was a stylised approximation. It is now rebuilt to
mirror the actual app surfaces — same labels, same colours, same badge states —
sourced directly from the product components in this repo. German UI text inside
the mock is correct: it depicts the product, whose UI is German (the landing
copy around it stays English).

**Files changed:** `apps/web/components/landing/sections/SendToCode.tsx`,
`apps/web/styles/landing.css` (§03 `.stc` block only).

## Rendered gate
- `after-sec03-desktop.png` — desktop, light.
- `after-sec03-mobile.png` — 375px (actions stack, filenames intact, no overflow).
- `after-sec03-dark.png` — dark landing theme (light product "screenshots" on the dark section).
- `before-sec03-desktop.png` — the previous stylised version, for contrast.

## Mock element → real source it mirrors (reviewer: verify they match)

| §03 mock element | Value in the mock | Real source (this repo) |
|---|---|---|
| Model chip | `Goblin Swift · INKLUSIVE ▾`, white-on-translucent on green | `components/app-shell/model-switcher.tsx:329,347-349` (`tierLabel` = `INKLUSIVE`; chip `rgba(255,255,255,.06)` bg, `rgba(255,255,255,.2)` border) |
| Model name | `Goblin Swift` | `lib/goblin-hosted-models.ts:12`; `components/chat/ChatInput.tsx:429` |
| User bubble | brand-green, white, radius `16px 4px 16px 16px` | `components/workspace/ChatMessage.tsx:71-80` (`var(--brand-green)`, `#fff`, `16px 4px 16px 16px`) |
| AI message | bare Goblin mark (24px), no bubble, inline text | `components/workspace/ChatMessage.tsx:88-99,121-130` |
| Chat code block | dark chrome: head `#1e1e1e`, body `#0d1117`, actions `#161b22`; plain light code `#e6edf3` | `components/workspace/CodeBlock.tsx:28-54` |
| Copy action | `Kopieren`, ghost, `rgba(255,255,255,.16)` border, copy icon | `components/workspace/CodeBlock.tsx:62-84` |
| Send action | `An Code senden`, gold `rgba(212,167,55,.16)`/border `.55`, text `#D4A737`, `</>` icon | `components/workspace/CodeBlock.tsx:85-103` |
| Code tab surface | light editor paper `#FBF7EC`, chrome `#F4ECD8`, rule `#D8CBA8` | `styles/design-tokens.css:360-366` (`--ed-canvas/--ed-chrome/--ed-rule`) |
| File card | icon + `Navbar.tsx` (mono) + `TSX · 12 Zeilen` + badge + chevron | `components/code/FileCardList.tsx:139-162` |
| GEÄNDERT badge | amber `#F7E8C2`/`#C7901A`, `GEÄNDERT +6 −2` (mono delta) | `components/code/FileCardList.tsx:92-98`; tokens `design-tokens.css:73-74` |
| NEU badge | green `#E1EDDE`/`#3D7A4F`, `NEU` | `components/code/FileCardList.tsx:85-90`; tokens `design-tokens.css:71-72` |
| Draft framing | `Entwurf · 2 Dateien` pill; "review the draft" lead | `FileCardList.tsx:61` (`change_state === "draft"`); `CodeEmptyState.tsx:38` |
| Colours | `--brand-green #1A3A2A`, `--brand-gold #D4A737` | `styles/design-tokens.css:16,18` (LOCKED tokens) |

All colours are hard-coded to the LOCKED token hex values (with the token noted
in a CSS comment) so the mock renders identically regardless of the landing's
own scoped token overrides, in light and dark.

## Optional real-screenshot upgrade path (kept)
`SendToCode.tsx` exposes `CHAT_SHOT` / `CODE_SHOT` constants (both `null`). Set
either to a public asset path (e.g. `/brand/landing/stc-chat.png`) and that panel
renders the real capture instead of the CSS mock — a drop-in fidelity upgrade
with the mock as graceful fallback.

## Gates
- Typecheck `@goblin/web` ✅ · Build ✅ (41/41 static pages, exit 0).
- Rendered §03 at desktop + 375px + dark, all clean (above).

## Honest limitations
- The mock is a CSS reproduction, not a literal screenshot; it mirrors the real
  components' labels/colours/states as cited above. For pixel-literal captures,
  use the `CHAT_SHOT`/`CODE_SHOT` slots (founder supplies the two images).
- Product surfaces render in their real (light) colours on both landing themes —
  by design, they read as product screenshots on the dark section.
- File-card sample values (`12 Zeilen`, `+6 −2`, `theme.css`) are representative
  of a real "add a dark-mode toggle" change, not a specific captured session.
