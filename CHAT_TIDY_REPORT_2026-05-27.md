# Chat Tidy Report — Token Completion + Dingbat Removal (Pre-04)

**Date:** 2026-05-27 · Resolves the two spec-vs-code drifts flagged in
`CHAT_CLEANUP_REPORT_2026-05-27.md` §3/§6. Three tasks only; no layout, color,
or feature changes; no mockup.

---

## 1 · Token added

File: **`apps/web/styles/design-tokens.css`** (the live token file — confirmed
via `rg --t-mono-sm apps/web/styles/`).

Added directly after `--t-mono-fs` in the mobile `:root` type-scale block:
```css
  --t-mono-sm-fs: 11px;   --t-mono-sm-lh: 1.40; --t-mono-sm-ls:  0.04em;
```

**Pattern matched:** the existing `--t-eyebrow-*` line
(`--t-eyebrow-fs / -lh / -ls`) — the only other mono-family token that carries
a non-zero tracking, so it has all three sub-tokens. `--t-mono` itself has just
`-fs`/`-lh` (tracking 0); `--t-mono-sm` per §A3.2 has tracking `0.04em`, so it
takes the three-sub-token form like `--t-eyebrow`. Values per
`GOBLIN_DESIGN_SYSTEM.md` §A3.2 (JetBrains Mono, 400, 11px, lh 1.40, ls 0.04em).
No desktop (`≥640px`) override added — §A3.2 lists a single 11px for
`--t-mono-sm`, matching how `--t-mono` is handled (no override).

The naming convention in the file is consistent (`--t-<name>-fs/-lh/-ls`), not
mixed — so no STOP condition was triggered.

---

## 2 · Message.tsx change

File: `apps/web/components/chat/Message.tsx` (code-block header filename line).

**Old** (plus the 3-line "ambiguous / needs review" comment above it, now
removed):
```tsx
                    <span style={{ fontSize: 11, color: "#9C9589", fontFamily: "JetBrains Mono, monospace", flex: 1 }}>
```
**New:**
```tsx
                    <span style={{ fontSize: 'var(--t-mono-sm-fs)', color: "#9C9589", fontFamily: "JetBrains Mono, monospace", flex: 1 }}>
```
Only the `fontSize` declaration changed (11px → `var(--t-mono-sm-fs)`, same
11px). No line-height/tracking added inline. The reviewer-note comment is gone.

---

## 3 · Dingbat replacement (CodeActionButton)

File: `apps/web/components/chat/standalone-chat.tsx`.

| Old glyph | New lucide icon | Label (unchanged) | Notes |
|---|---|---|---|
| `✦` | `ArrowUpRight` | "Send to Code" | Directional "push elsewhere"; disabled while `hasProject=false`. |
| `□` | `Copy` | "Copy code" | — |
| `⬇` | `Download` | "Download as file" | — |

Three semantically distinct icons, each `size={14}`, `currentColor` (inherits
the DropItem disabled/enabled color cascade — disabled "Send to Code" keeps its
`var(--meta)` color).

**Interface change (the one permitted):** `DropItem` gained an optional
`icon?: ReactNode` prop (added `type ReactNode` to the existing `react` import).
The glyphs were removed from the `label` strings and the icon now renders as a
separate JSX child before the label inside a `display:flex; align-items:center;
gap:8` span; `sub` still renders below, unchanged. Dropdown position, padding,
fontSize (13), disabled state, sub-labels — all identical.

---

## 4 · Verification

- **`rg --t-mono-sm apps/web/styles/`:**
  ```
  apps/web/styles/design-tokens.css:  --t-mono-sm-fs: 11px;   --t-mono-sm-lh: 1.40; --t-mono-sm-ls:  0.04em;
  ```
- **Expanded emoji grep** (now covering U+25A0–25FF and U+2B00–2BFF too):
  ```
  $ rg -P "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}\x{25A0}-\x{25FF}]" \
        apps/web/components/chat/ apps/web/app/dashboard/chat/
  (no output — zero hits)
  ```
- **typecheck** (`pnpm --filter @goblin/web typecheck`): **PASS** (exit 0).
- **build** (`pnpm --filter @goblin/web build`): **PASS** (exit 0).

---

## 5 · Anything unexpected

Nothing. The token file used one consistent convention, so `--t-mono-sm`
slotted in cleanly against the `--t-eyebrow` precedent; the dingbat swap was a
straight glyph-for-icon replacement with the single sanctioned `icon?` prop on
`DropItem`. The expanded grep range now returns zero across the whole chat
path.
