# Max-Walk Feedback — 2026-06-03 Night (verbatim)

Source: Vincent's iPhone Max-walk after Sprint 10.7 close.
Outcome: BIG progress, ~70% of critical UX now sitzt. Remaining issues concrete and named.

## WHAT WORKS NOW — DON'T BREAK
- Groq key adds cleanly in NEW settings (not old)
- Chat with Groq Llama 3.3 70B streams fine
- Multi-file Send-to-Code: separate index.html/style.css arrive at Code Tab
- "Sichern" works
- Vercel-Token can be added via Settings → Konnektoren

## WHAT NEEDS FIX

### (1) Send-to-Code button is a BLACK BOX
- In chat, code-icon at bottom of AI message
- Says "Send to Code" but unclear:
  * Which file(s)?
  * How many?
  * Will it overwrite existing files in project?
- Vincent expected to see a preview before sending
- Current: surprise — user discovers what happened after
- Need: a preview sheet that shows what's about to land
  ("3 files: index.html, style.css, script.js → project X. [Send all] [Pick files] [Cancel]")

### (2) Code-Tab mobile bottom-row design (third time mentioned)
- Buttons overlap, text too long
- "Kopieren Verwerfen Entwurf" + "Sichern" + "Veröffentlichen" = too many words on a 390px screen
- Vincent's suggestion: use icons instead of words (save icon, publish icon, etc.) with tooltips
- Make it actually mobile-friendly

### (3) Code-Tab has NO multi-file navigation
- User can search WITHIN the open file (Ctrl+F works)
- But can't see/switch between the other files that were sent from chat
- File tabs at top ARE there ("generated-code.js x style.css x") but no way to OPEN the file list view or browse the project tree
- Vincent: "Claude Code should spend 3-6h dedicated energy on this page. Not throw away what's there. It's good but not 1000% finished."

### (4) Code-Tab Chat (the in-workspace chat next to editor)
- User typed "mache den Hintergrund blau"
- AI responded with EXPLANATION + new style.css file
- Did NOT live-edit the open file
- User can't see the result
- Buttons overlap so user can't even review/approve the new file
- Question: should code-tab-chat live-edit OR generate diff + show approve/reject?
- Decision needed (propose architecture)

### (5) Vercel "Öffnen" → 404 again
- Vincent: vercel link goes via auth, then 404
- Hypothesis: "Goblin sendet vielleicht Auth-Token dahin mit, deshalb kommt es immer mit Authentication?"
- Possible: Vercel Deployment Protection on Vincent's personal Vercel account (the one used for actual deploy)
- Or: Goblin's URL construction wrong
- Or: user-token has "private" scope by default
- Must finally fix this — third sprint touching it
