# Mobile Header Audit — Pre-Code-Edit for Screen 04 v2

**Date:** 2026-05-28
**Scope:** Read-only. No source files modified.

## 1. Files inspected

| File | Role |
|------|------|
| `apps/web/components/layout/Header.tsx` | Sole live header render path. Single component for desktop + mobile; mobile variant driven by CSS media queries (`@media max-width:768px`) inside the component's `<style>` block, not a separate file. |
| `apps/web/components/brand/GoblinLogo.tsx` | Renders the g-mark inside the logo button (referenced, not order-determining). |
| `apps/web/components/header/AvatarMenu.tsx` | Renders the trailing avatar (referenced, not order-determining). |

No separate mobile-header component exists. `Header.tsx` is the only file that renders mobile header chrome.

## 2. Verbatim JSX excerpts (order-determining DOM sequence)

DOM source order of direct header children, `Header.tsx`:

**Hamburger** — L97-115 (mobile-only via `.goblin-hamburger`):
```tsx
97   {/* Hamburger — mobile only */}
98   <button
99     onClick={onMenuToggle}
100    className="goblin-hamburger"
...
108    display: 'none', alignItems: 'center', justifyContent: 'center',
```

**Logo button (g-mark + wordmark)** — L120-136:
```tsx
120  <button
121    onClick={() => router.push('/dashboard')}
...
128    <GoblinLogo state="idle" size={26} variant="gold" />
129    <span className="goblin-wordmark" ...>
134      Goblin
```

**Mode-tile** — L140-203 (mobile-only via `.goblin-mode-tile`):
```tsx
138  {/* Mobile mode tile — current mode + switcher (§TASK 5)... */}
140  {showTabs && (
141    <div className="goblin-mode-tile" style={{ position: 'relative', flexShrink: 0, display: 'none' }}>
```

**Breadcrumb** — L206-223 (hidden on mobile via `.goblin-breadcrumb`).

**Spacer** — L225:
```tsx
225  <div style={{ flex: 1, minWidth: 8 }} />
```

**Tab-pills** — L228-287 (hidden on mobile via `.goblin-tab-pills`).

**Plus FAB** — L290-344:
```tsx
289  {/* Plus FAB */}
290  <div ref={plusRef} style={{ position: 'relative', flexShrink: 0 }}>
291    <button onClick={() => setPlusOpen(p => !p)} data-testid="header-plus" ...>
```

**Avatar** — L352:
```tsx
350  {/* Avatar — opens BottomSheet menu... */}
352  <AvatarMenu />
```

**Media-query visibility** — L357-365:
```tsx
357  @media (max-width: 768px) {
358    .goblin-hamburger { display: flex !important; }
359    .goblin-breadcrumb { display: none !important; }
360    .goblin-wordmark { display: none !important; }
363    .goblin-tab-pills { display: none !important; }
364    .goblin-mode-tile { display: block !important; }
365  }
```

## 3. Determined order

DOM source order: hamburger → logo-button → **mode-tile** → breadcrumb → spacer → tab-pills → plus → avatar.

After mobile media queries hide breadcrumb + tab-pills + wordmark, the rendered mobile order is:

**hamburger → logo-button (mark only) → mode-tile → spacer → plus → avatar**

The mode-tile sits at L140, **before** the spacer at L225. It is left-aligned, immediately after the logo — not right-aligned before the plus.

## 4. Verdict

**(B) Live matches built_04_v1.html (wrong).**

Justification: the mode-tile renders before the spacer (`[ham][g-mark][mode-tile][spacer][+][avatar]`), which is the v1 order; the v7/v2 pattern requires the spacer immediately after the g-mark and the mode-tile moved right (`[ham][g-mark][spacer][mode-tile][+][avatar]`). The header must be fixed in the 04 code-edit pass — move the mode-tile block (L140-203) to sit after the spacer (L225).

## 5. Other observations (NOT acted on)

- **Single source of truth:** desktop/mobile share one component; the fix is a DOM-order move of the `.goblin-mode-tile` block past the spacer, scoped so the desktop tab-pills layout is unaffected (mode-tile is `display:none` on desktop, so moving it has no desktop visual impact).
- **Logo composition matches references:** mark + wordmark button, wordmark hidden ≤768px → mark-only on mobile. Consistent with v7/v2. No discrepancy.
- **Trailing element is `<AvatarMenu />`**, a component, not an inline `.avatar` div as in the mockups. Renders equivalently (trailing avatar). Naming differs from mockup, behavior matches — no order impact.
- **Breadcrumb is order-inert on mobile** (`display:none`), so its DOM position between mode-tile and spacer does not affect the rendered mobile sequence.
