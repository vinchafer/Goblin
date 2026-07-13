# CW-6 — Restore tactile feedback on borderless nav controls (evidence)

**Offender (DIAGNOSIS Part A.0):** two controls set `WebkitTapHighlightColor:'transparent'`, removing Android's native press highlight **without substituting anything** — `Sidebar.tsx:434-440` (mobile close ×) and `bottom-tab-bar.tsx:55-66` (tabs).

**Finding after CW-1:** both are `<button>`s with **no inline `transform`**, so CW-1's global `:active` scale now covers them (verified by reading both). The live mobile switcher — the Header **mode-tile** (`Header.tsx:171`) + its menu items (`Header.tsx:205`), which the diagnosis flagged as the actually-mounted switcher — are also plain `<button>`s with no inline transform, so **CW-1 covers them too**. The `transparent` override is therefore now correctly *paired with a substitute*.

**Fix (targeted hardening, keeps the clean look):** a 3% scale is a weak cue on a transparent-background nav item, so add a `.tap-press-tint` utility (globals.css) that also flashes a faint `currentColor` background tint on `:active`, applied to the two flagged controls. The native tap-highlight stays suppressed (no ugly grey/blue box); the press cue is now scale **+** tint.

```css
.tap-press-tint:active:not(:disabled) {
  background: color-mix(in srgb, currentColor 10%, transparent) !important;
}
```
`!important` is required to beat the inline `background` these buttons set; `currentColor` adapts per control/theme (green when a tab is active, the close-×'s grey otherwise).

**Gate (deterministic):** `.tap-press-tint` rule present in globals.css; `className="tap-press-tint"` on `Sidebar.tsx` close button and each `bottom-tab-bar.tsx` tab; both remain covered by CW-1's scale. Device "feel" is founder-felt on deploy.

**Regression:** additive class + one CSS rule; the `WebkitTapHighlightColor:'transparent'` is intentionally **kept** (world-class pattern: suppress native box, provide own cue). No handler or layout changed.
