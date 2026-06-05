# Phase 0 — Edit-in-place VERIFY (prod, vinc.hafner3)

Prod: justgoblin.com, API goblinapi-production.up.railway.app @ f45a673 (HEAD, deployed).
Account: vinc.hafner3 (Groq / llama-3.3-70b-versatile). Project: "Test Vincent"
(c7f53841-4478-43cb-a493-e56b170635bf), newsletter build (index.html / styles.css / script.js).

## Result: PASS

Code-tab session shows the project's REAL files (index.html, script.js, styles.css)
— hydrated from project storage (the 11A-1 fix). Before the fix the session was empty.

Fresh edit issued in the session chat: **"mach den Hintergrund grün"** (Groq).

- Assistant: "Um den Hintergrund grün zu machen, müssen wir die CSS-Eigenschaft
  `background-color` im `body`-Element ändern … Die Änderung wurde im `styles.css`-File
  vorgenommen." → returned **styles.css** (the existing file).
- File list after: index.html, script.js, **styles.css** — exactly ONE styles.css.
  No `styles-1.css` / no new parallel file.
- styles.css body now: `background-color: #00ff00; /* Hintergrund grün */`.
  Header (`#333`) and `.newsletter-form` (`#f7f7f7`) styles PRESERVED → a targeted
  edit to the existing file, not a freshly invented one.
- The changed file is a draft (Entwurf badge) → reviewable before Save/Publish.

Screenshot: after-green-styles.png (styles.css open, green body bg, draft).

Note (0.3): tested on Groq per brief — works. Gemini-in-code-tab not re-tested this
pass; if separately broken it does not block the Groq path.
