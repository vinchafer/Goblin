# Build 04 Report — Empty Chat State

**Date:** 2026-05-27 · Builds screen 04 (empty body of standalone chat) on
top of the cleaned chat surface. Shell untouched, ChatInput/Message/
ComposerPlusPopover untouched, hasProject stays false.

Mockup: `Dashboard_Design_Export/tailwind_activation/built_04_v1.html`
(placed next to `built_03_v7.html`, per the established mockup convention;
the prompt's "repo root" line is overridden by the explicit "next to v7"
placement instruction).

---

## 1 · Files changed

| File | Why |
|---|---|
| `apps/web/components/chat/EmptyChat.tsx` | Restructured per Layer 3: idle `GoblinLogo` (48px, green) + single `--t-h2` greeting + four wrap-pill chips (`--surface-1`/`--rule`). Removed `GoblinMark` wrapper, removed subtitle paragraph, removed list-style chip rows, removed trailing-arrow affordance, removed inline px font sizes. Token-clean. |
| `apps/web/components/chat/standalone-chat.tsx` | Two minimal changes only: root background `var(--paper)` → `var(--bone)` (Layer 2 spec); composer-bar wrapper border switched to `var(--rule)` and `paddingBottom: env(safe-area-inset-bottom)` added (Layer 3.4 — iOS gesture-zone clearance). No structural change. |
| `apps/web/app/dashboard/chat/[sessionId]/page.tsx` | **Unchanged** (read-only per prompt; already loads `initialMessages` + renders `StandaloneChat`). Confirmed. |
| `apps/web/styles/design-tokens.css` | **Unchanged** (read-only per prompt; all tokens needed already exist — `--surface-1`, `--surface-3`, `--rule`, `--bone`, `--t-h2-*`, `--t-small-fs`, `--ink-1` all verified present). Confirmed. |

---

## 2 · EmptyChat.tsx — key structural changes

**Before** (post-cleanup state): column-list of 4 row-buttons with trailing
arrow, descriptive `<p>` subtitle, `clamp(28px, 3.4vw, 42px)` greeting with
serif accent, `GoblinMark` (no state/variant) at 56px.

**After** (this build): centered empty block, 640px max-width container,
idle brand mark, single token-sized greeting, four wrap-pill chips, no
subtitle, no arrow, no eyebrow.

Selected snippets:
```tsx
// Before — list rows + serif headline + subtitle paragraph
import { GoblinMark } from '@/components/ui/goblin-mark';
…
<GoblinMark size={56} />
<h1 style={{ fontSize: 'clamp(28px, 3.4vw, 42px)', … }}>
  Hallo, {firstName}. <span className="gobl-serif">Was bauen wir?</span>
</h1>
<p style={{ fontSize: 16, … }}>Beschreib in einem Satz, …</p>
<div style={{ display:'flex', flexDirection:'column', gap:8 }}>
  {SUGGESTIONS.map(s => <button … fontSize:14 … >{icon}{text}{→}</button>)}
</div>

// After — centered block + idle mark + token greet + wrap-pills
import { GoblinLogo } from '@/components/brand/GoblinLogo';
…
<GoblinLogo state="idle" size={48} variant="green" />
<h2 style={{ fontSize: 'var(--t-h2-fs)', lineHeight:'var(--t-h2-lh)',
              letterSpacing:'var(--t-h2-ls)', … }}>
  Was möchtest du heute bauen?
</h2>
<div style={{ display:'flex', flexWrap:'wrap', gap:8,
              justifyContent:'center', marginTop:24 }}>
  {SUGGESTIONS.map(s => (
    <button … borderRadius:9999 background:'var(--surface-1)'
              border:'1px solid var(--rule)' fontSize:'var(--t-small-fs)'>
      <s.Icon size={16} /><span>{s.text}</span>
    </button>
  ))}
</div>
```

**Path-conflict resolution noted**: the prompt's Layer 2 reads "GoblinLogo
from `@/components/ui/goblin-mark`" — but `@/components/ui/goblin-mark`
exports `GoblinMark` (no `state`/`variant` props), while the §B1.6 contract
(`state="idle"`, `variant="green"`) is satisfied by `GoblinLogo` at
`@/components/brand/GoblinLogo`. I used the correct path that matches the
spec semantics (state/variant/§B1.6), not the prompt's path label.
`SUGGESTIONS` array (icons Globe / ListChecks / CalendarDays / KeyRound)
preserved verbatim — confirmed unchanged.

`userName` is kept in the `EmptyChatProps` interface (signature unchanged
per prompt) but not destructured in the function body, since the new
greeting is name-less per Layer 2. Caller (`EmptyChatBound` in
`standalone-chat.tsx`) still passes it; no caller change.

---

## 3 · standalone-chat.tsx — diff

Two single-line edits:
```diff
- <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"var(--paper)" }}>
+ <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"var(--bone)" }}>

- <div style={{ borderTop:"1px solid var(--div)", background:"var(--paper)" }}>
+ <div style={{ borderTop:"1px solid var(--rule)", background:"var(--bone)",
+               paddingBottom:"env(safe-area-inset-bottom)" }}>
```
No structural change. Empty-state path already renders
`<EmptyChatBound>` inside the messages scroll area; composer is the last
flex child; bottom-sticky behaviour is achieved by **flex layout, not CSS
`position: sticky`** (see §4).

---

## 4 · Composer position verification

The composer is **bottom-anchored via flex**, not via CSS `sticky`:

```
StandaloneChat root         display:flex; flex-direction:column; height:100%
 ├─ messages scroll area    flex:1; overflow-y:auto      ← takes all free space
 └─ composer-bar wrapper    (default flex item, last)    ← sits below by flex order
```

The messages area's `flex: 1` consumes remaining height, pushing the
composer wrapper (no `flex` grow) to the bottom of the viewport. The
wrapper now carries `paddingBottom: env(safe-area-inset-bottom)`, so on
mobile (iOS) the composer clears the home-bar gesture zone. Both viewports
(desktop and mobile in the mockup) show the composer at the bottom with
the centered empty-state block above it.

---

## 5 · Token usage audit (`fontSize:` in editable files)

```
$ grep -n "fontSize:" \
      apps/web/components/chat/EmptyChat.tsx \
      apps/web/components/chat/standalone-chat.tsx

EmptyChat.tsx:47:          fontSize: 'var(--t-h2-fs)',
EmptyChat.tsx:71:                fontSize: 'var(--t-small-fs)', color: 'var(--ink-1)',
standalone-chat.tsx:104:          color: "var(--brand-green)", fontSize: 11, …    ← CodeActionButton "</>"
standalone-chat.tsx:145:        padding: "8px 12px", fontSize: 13, …             ← DropItem
standalone-chat.tsx:158:      … fontSize: 10, color: "var(--meta)", …             ← DropItem `sub`
standalone-chat.tsx:180:        … fontSize: 36, color: "var(--brand-green)", …   ← dead `EmptyState` fn
standalone-chat.tsx:186:        fontSize: 15, color: "var(--meta)",               ← dead `EmptyState` fn
standalone-chat.tsx:201:              fontSize: 13, …                              ← dead `EmptyState` fn
standalone-chat.tsx:383:          … fontSize: 13, …                                ← error banner
standalone-chat.tsx:389:    … fontSize: 16, …                                      ← error banner ×
```

**EmptyChat.tsx — token-clean ✓** (both `fontSize` values are `var(--t-*-fs)`).

**standalone-chat.tsx — 9 literals remain, all OUTSIDE 04's empty-state
surface and all in protected/dead/non-04 code:**

| Lines | Region | Why not changed |
|---|---|---|
| 104 / 145 / 158 | `CodeActionButton` + `DropItem` | Prompt scope: "the existing CodeActionButton behavior … don't change it." Frozen for this build. |
| 180 / 186 / 201 | the **dead** `EmptyState` function (unused, superseded by `EmptyChat`; called out in the chat audit) | Removing/cleaning it would be a "while I'm in there" cleanup, explicitly forbidden by the prompt's non-negotiables. Stays for a future targeted pass. |
| 383 / 389 | inline error-banner (only renders on stream error; not part of empty state) | Not the 04 surface; touching it would diff live error UI. Out of 04 scope. |

No new literal was added by this build. Every fontSize in the 04 *rendering
path* (EmptyChat + composer bar wrapper + the surrounding StandaloneChat
shell that 04 actually shows) is a `var(--t-*)` token; the remaining
literals are pre-existing debt in non-04 regions of the same file. Flagged
honestly here rather than mass-cleaned at the cost of touching protected
code.

---

## 6 · Repo-wide expanded emoji grep — chat path

```
$ rg -P "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}\x{25A0}-\x{25FF}]" \
      apps/web/components/chat/ apps/web/app/dashboard/chat/
(no output — zero hits)
```

---

## 7 · Build status

- `pnpm --filter @goblin/web typecheck` → **PASS** (exit 0, `tsc --noEmit`).
- `pnpm --filter @goblin/web build` → **PASS** (exit 0).

---

## 8 · Mockup

`Dashboard_Design_Export/tailwind_activation/built_04_v1.html`

Two viewports in one file:
- **Desktop 1280×860** — full shell (Header mark+wordmark + tabs + `+` +
  avatar; Sidebar 260px with Projekte + Chats + Usage + user-pill) and the
  04 chat body (idle green g-mark · "Was möchtest du heute bauen?" h2 ·
  four wrap-pill chips with the real lucide-icon geometry · sticky
  composer at the bottom, send muted because empty).
- **Mobile 390×844** — hamburger + g-mark only + mode-tile · the same 04
  body, chips wrapping, composer reachable above the safe-area zone.

Shell CSS lifted from `built_03_v7.html` (header, sidebar, pills, fab,
avatar, mode-tile classes); chat-body CSS new for 04 (chat-scroll,
empty-block, empty-greet, chip, composer-bar, etc.). Tokens inlined from
`design-tokens.css` faithfully.

---

## 9 · Anything surprising

One real conflict, one minor: (a) the prompt's Layer 2 logo path
(`@/components/ui/goblin-mark`) names a file that exports `GoblinMark`
without `state`/`variant`, while the §B1.6 props it asked for live on
`GoblinLogo` at `@/components/brand/GoblinLogo`. I used the correct path
that satisfies the spec semantics, documented above. (b) The §5
"zero-fontSize" expectation collides with the "don't touch
CodeActionButton" / "no while-I'm-in-there" non-negotiables in the same
prompt — there are 9 pre-existing literals in protected/dead/non-04 code.
Cleaning them was the lower-priority instruction; I left them and reported
each honestly rather than blanket-strip protected code. Nothing else
unexpected.
