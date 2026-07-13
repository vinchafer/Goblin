# CW-1 — Global press feedback (evidence)

**Change:** `apps/web/app/globals.css` — add a global `:active` scale + `touch-action: manipulation` for every `button` / `[role="button"]` / `a[role="button"]` (excluding disabled/aria-disabled).

**Gate (deterministic, CSS-level — a device render is impossible in this sandbox):**

- **BEFORE (HEAD `516526e`):** no global `button:active` rule existed. `grep "button:active|touch-action: manipulation"` on the committed file → **0 matches**. The only `:active` rules were the opt-in `.btn:active` (globals.css:261) and `.btn-press:active` (175), which none of the audited inline-styled controls use — i.e. **dead code** for the offenders (see DIAGNOSIS Part A.0).
- **AFTER (working tree):** a global rule now resolves for every interactive control:
  ```css
  button:not(:disabled):not([aria-disabled="true"]):active,
  [role="button"]:not([aria-disabled="true"]):active,
  a[role="button"]:active { transform: scale(0.97); transition: transform 0.08s ease; }
  ```
  plus `touch-action: manipulation` on the same set.

**Coverage:** applies to the ~137 raw `<button>` sites in `apps/web` at once, precisely because they share the inline-button pattern. The audited offenders (chat back `standalone-chat.tsx:588-603`, sheet buttons `BottomSheet.tsx:209-285`, sidebar rows, send `ChatInput.tsx:1017`, model switch/pill, publish `.gobl-btn`) set **no inline `transform`**, so the stylesheet `:active` wins → they now scale on press.

**Honest caveat (documented in the CSS comment too):** a control that sets an **inline** `transform` (higher specificity than a stylesheet rule) will not take the scale. In this codebase only the design-system `<Button>` hover (`ui/button.tsx:85` `translateY(-1px)`) does that, and only while a synthetic hover is active — it keeps its hover cue regardless. `prefers-reduced-motion` (globals.css:177 block) collapses the transition to ~0 → an instant snap, not a bounce.

**Regression:** additive CSS only; no existing selector changed. `.btn:active` / `.btn-press:active` still work as before (unchanged lines).
