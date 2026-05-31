# Code Tab — Proposed Tokens (for GOBLIN_DESIGN_SYSTEM v1.2 review)

PROPOSED additions only. Nothing here overrides a LOCKED v1.1 anchor. These support
the light editor surface + syntax palette designed in
`CODETAB_REIMAGINE_ARCHITECTURE_2026-06-01.md` Section E. Vincent reviews before
they enter the SSOT.

## 1. Editor surfaces (light = default)
```css
--editor-canvas-light:    #FBF7EC;  /* = surface-1 (paper) */
--editor-chrome-light:    #F4ECD8;  /* = surface-2 (bone)  */
--editor-activeline-light: rgba(26,58,42,0.04);   /* brand-green @ 4% */
--editor-selection-light:  rgba(212,167,55,0.20); /* gold @ 20% */
--editor-rule-light:      #D8CBA8;  /* = rule */
```

## 2. Editor surfaces (dark = option, retuned warm-dark)
```css
--editor-canvas-dark:     #3F3A2C;  /* = surface-ink-1 (warm-dark, NOT the old #28251D/#08170F) */
--editor-chrome-dark:     #28251D;  /* gutters/panels */
--editor-activeline-dark: rgba(212,167,55,0.06);
--editor-selection-dark:  rgba(212,167,55,0.18);
```

## 3. Syntax palette — "Goblin Light" (AA-legible on #FBF7EC)
```css
--syn-keyword-light:  #2A523E;  /* green-600 */
--syn-string-light:   #9A6B1E;  /* darkened ochre, ≥4.5:1 */
--syn-number-light:   #355B7A;  /* info */
--syn-comment-light:  #8A8268;  /* warm-grey, ≥4.5:1 */
--syn-function-light: #355B7A;
--syn-variable-light: #0F2B1E;  /* ink-deep */
--syn-punct-light:    #5F5640;  /* ink-3 */
--syn-tag-light:      #5E4514;  /* gold-900 */
--syn-invalid-light:  #B0432A;  /* danger */
```

## 4. Syntax palette — "Goblin Dark" (on #3F3A2C)
```css
--syn-keyword-dark:  #87A998;  /* green-300 */
--syn-string-dark:   #E8C97F;  /* gold-300 */
--syn-number-dark:   #B5CCC0;  /* green-200 */
--syn-comment-dark:  #968768;  /* ink-on-dark-3 */
--syn-variable-dark: #FBF7EC;  /* ink-on-dark-1 */
--syn-punct-dark:    #D8CBA8;  /* ink-on-dark-2 */
```

## 5. Change-state semantics
```css
--state-draft:     #BC8E2E;  /* gold-600 — Entwurf (hollow dot) */
--state-saved:     #3D7A4F;  /* success — Gesichert (filled check) */
--state-deployed:  #D4A737;  /* gold — Veröffentlicht (live URL chip) */
```

All contrast pairs verified ≥4.5:1 against their canvas (normal text) except where
used at large sizes. Theme selection via `data-editor-theme="light|dark"` on the
Code Tab root, persisted per user in settings.
