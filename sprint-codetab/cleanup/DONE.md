# Goblin — Pre-walk Cleanup: DONE

**Walked:** 2026-06-07, prod `https://goblin-web.vercel.app`, mobile **390**, logged in as
**vinc.hafner3** ("HALLO, VINC.HAFNER3" — never personal). Real taps + screenshots in
`sprint-codetab/cleanup/screens/`.

**Deployed:** `origin/master == HEAD == 08404df`. Typecheck (web + api) PASS, prod build
(web + api) PASS. E2E **@public 81 passed, 1 flaky** (login Terms/Privacy link, passed on
retry). Honest gap unchanged: **code-tab / build-flow have no spec coverage** — verified by
hand this round.

**Guards:** publish loop untouched and not triggered (no real deploy). No invented data.
Groq Llama stays the working default (verified — answers every probe/chat). vinc.hafner3 only.

---

## Per-fix verdicts

| Fix | Item | Verdict | Evidence |
|-----|------|---------|----------|
| FIX 1 | Model picker won't close (NEW-1) | **GREEN** | closes on selection, Esc, backdrop tap, and pill re-tap. `screens/cl-gem-selected.png`, `cl-esc.png`, `cl-retap.png` |
| FIX 2 | Settings sheet persists (NEW-2) | **GREEN** | open Settings → in-app nav → sheet gone, destination clean. `screens/cl-fix2-open.png` → `cl-fix2-after.png` |
| FIX 3 | STC files render late (NEW-3) | **GREEN** | STC → Neues Projekt → code tab shows index.html + app.js in the editor on arrival, no empty-thread flash, no reload. `screens/cl-stc-fp2.png` |
| FIX 4 | Gemini liveness + preflight (AMBER-1) | **GREEN (mechanism)** | Gemini DEAD proven; probe endpoint returns ok:false for Gemini / ok:true for Llama on prod. UI wiring shipped + built; awaiting Vercel propagation. |
| FIX 5 | Normal publish→preview render (AMBER-7) | **FOUNDER** | test account has GitHub disconnected; reconnect needs an OAuth login I must not do autonomously. Founder reconnects + confirms render during his walk. Honest "In Vercel öffnen" panel already ships for the protected case. |

---

## FIX 1 — model picker (NEW-1)

`components/chat/ChatInput.tsx`. The `ModelHub` overlay covered the composer and wouldn't
dismiss. Root causes + fixes:
- Outside-tap used `mousedown` → unreliable on iOS touch. Now `pointerdown` (covers
  mouse + touch). `ChatInput.tsx:494`
- No Escape handler. Added. `ChatInput.tsx:503`
- Pill `onClick={openHub}` always opened → re-tap couldn't close. Now toggles. `ChatInput.tsx:687`
- Selection now closes explicitly too (`setHubOpen(false)` in `onSelect`). `ChatInput.tsx:599`

Verified all four paths on prod: re-tap closes, Esc closes, backdrop tap closes, and
selecting Gemini closed the hub + left the composer usable.

## FIX 2 — settings sheet (NEW-2)

`components/app-shell/dashboard-shell.tsx:56`. Added a `usePathname()` effect that calls
`closeSettings()` on navigation (skips first mount). `SettingsSheet` is gated on
`showSettingsSheet`, so this unmounts the sheet + resets its internal SheetStack. Verified:
opened Settings, clicked a project (soft nav) → landed on the project overview with **no
settings sheet** stacked over it.

## FIX 3 — STC first paint (NEW-3)

`components/code/SessionPane.tsx:104`. The "foreground editor when files load" one-shot
consumed its flag even when `files.length === 0` (a fetch-vs-write race after STC created
the session), stranding the user on the empty thread until a reload. Now it only consumes
the flag once files actually exist (deps include `files.length`, so it re-runs). Verified:
STC → Neues Projekt → the editor shows the files directly, no empty flash, no reload.

## FIX 4 — Gemini liveness, finally answered (AMBER-1 → resolved)

**Outcome: Gemini-via-BYOK is DEAD on prod.** With the picker fixed I ran the clean test:
- Llama (`groq/llama-3.3-70b-versatile`): answers ("PING"). `screens/cl-llama-control.png`
- Gemini (`google/gemini-2.5-pro-...`): **"Deine Sitzung ist abgelaufen", no output** — in
  the SAME session/minute Llama worked. `screens/cl-gem-result.png`

So Gemini doesn't generate (the "session expired" message is a mis-mapped provider failure,
not a real auth issue — Llama proves the session is alive).

**Deterministic fix shipped (FIX4):** `POST /api/models/probe` (`apps/api/src/routes/models.ts`)
does a tiny REAL generation with the chosen model + the user's key. `ModelsPage` "Standard
setzen" now probes first, shows "Prüfe…", and on failure refuses with
*"Antwortet derzeit nicht — nicht als Standard gesetzt."* — so a user can't pin a dead model
as default, independent of circuit-breaker warmth.

**Verified on prod (authed, direct):**
```
GEMINI probe → {"ok":false,"error":"no_response"}
LLAMA  probe → {"ok":true}
```
The probe endpoint is live on Railway and behaves exactly right. The ModelsPage UI wiring is
built + compiled clean and pushed; at verification time the Vercel web deploy of that commit
was still propagating (many queued builds today), so the in-browser "Prüfe…" wasn't yet
visible — but the deterministic backend is proven. (Founder will see "Prüfe…" → refuse on
Gemini once the web deploy lands, imminent.)

## FIX 5 — publish→preview render (AMBER-7 → founder)

Unchanged from Round 3: the vinc.hafner3 test account has **GitHub disconnected**, and
reconnecting requires a GitHub OAuth login I should not perform autonomously. Without a
GitHub repo the project can't publish, so there's no `previewUrl` to render in-app. **Founder
reconnects GitHub during his walk and confirms the live page renders in Preview.** The honest
"In Vercel öffnen" escape panel (shipped Round 3) covers the protected/'manual' case.

---

## Small note (not fixed — flagged)
- The composer model picker **auto-selects the first BYOK model on open** (legacy behavior).
  For this account that's Gemini — so merely opening the picker switches the active model to
  the dead Gemini. Cosmetic-ish (the user still sees the pill change), but worth revisiting
  given Gemini is dead. Separate from the dismissal fix.
- Display-name random suffix ("Vincent 716" this session) is consistent ACROSS surfaces
  (Round-3 fix holds) but the stored suffix still regenerates BETWEEN sessions — a deeper
  "persist once" item, out of scope here.

## Commits (pushed; origin/master == HEAD == 08404df)
- `d27f4c2` CLEANUP-1 picker dismissal
- `5bcf51a` CLEANUP-2 settings sheet closes on nav
- `bf35c78` CLEANUP-3 STC first-paint foreground
- `08404df` FIX4 Gemini probe + "Standard setzen" preflight
