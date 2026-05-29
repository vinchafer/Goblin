# Build 05 + 06 — Caret Position Fix

**Date:** 2026-05-28
**Addresses:** BUILD_05_06_IMPL_2026-05-28.md §15 — streaming caret sat below the last `<p>` instead of inline. Moved JSX span → CSS `::after`.

## 1. Files changed

| File | Why |
|------|-----|
| `apps/web/components/chat/Message.tsx` | Add `data-streaming` to `.msg-content`; remove caret span + unused `showCaret` const. |
| `apps/web/app/globals.css` | Replace `.caret` element rule with `::after` pseudo-element on the last child of a streaming message. |

## 2. EDIT 1 — Message.tsx

**`.msg-content` opening tag — before:**
```tsx
<div className="msg-content">
```
**after:**
```tsx
<div className="msg-content" data-streaming={isStreaming || undefined}>
```

**Removed caret line (before):**
```tsx
            </ReactMarkdown>
            {showCaret && <span className="caret" />}
          </>
```
**after:**
```tsx
            </ReactMarkdown>
          </>
```

Also removed the now-unused `const showCaret = isStreaming && msg.content.length > 0;`. GoblinLogo state binding, ReactMarkdown call, model footer — unchanged.

## 3. EDIT 2 — globals.css

**Old `.caret` rule:**
```css
.caret {
  display: inline-block;
  width: 2px;
  height: 1.05em;
  background: var(--ink-1);
  vertical-align: text-bottom;
  margin-left: 1px;
  animation: caret-blink 1s step-end infinite;
}
```
**New selector:**
```css
/* Streaming caret — sits inline after the last word of the last
   paragraph in a streaming assistant message. CSS-only; no JSX. */
.msg-content[data-streaming] > :last-child::after {
  content: "";
  display: inline-block;
  width: 2px;
  height: 1.05em;
  background: var(--ink-1);
  vertical-align: text-bottom;
  margin-left: 2px;
  animation: caret-blink 1s step-end infinite;
}
```
`@keyframes caret-blink` unchanged. No new keyframes, no token changes. Color/width/timing identical — only implementation moved (margin-left 1px → 2px per spec).

## 4. Verification greps

| Grep | Result |
|------|--------|
| `showCaret` in Message.tsx | 0 hits ✓ |
| `className="caret"` in Message.tsx | 0 hits ✓ |
| `data-streaming` in Message.tsx | 1 hit (`.msg-content` attr) ✓ |
| `data-streaming` in globals.css | 1 hit (new selector) ✓ |

**Visual trace:** streaming → `data-streaming` present → selector matches → inline `::after` caret on last child, blinking. Idle → attribute omitted (`isStreaming || undefined`) → selector misses → no caret.

## 5. Build status

- `pnpm --filter @goblin/web typecheck` → **PASS**.
- `pnpm --filter @goblin/web build` → **PASS**.

## 6. Surprising

Nothing. Pure layer-3 swap from JSX span to CSS pseudo-element; caret now renders inline at the end of the last streamed paragraph. Edge cases (stream ending on a list or code block) put the caret after that block per the documented trade-off — acceptable, unchanged from spec intent.
