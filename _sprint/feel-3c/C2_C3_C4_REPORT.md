# FEEL-3c C2 / C3 / C4 — report + evidence

Screenshots: `shots/c_states_{light,dark}_{375,1440}.png` — a **static render of the real
`AgentRunView` component states**, inline styles + `--ed-*`/`--font-*` tokens ported verbatim from
`AgentRunView.tsx` and `dashboard-tokens.css`. Repro: `node _sprint/feel-3c/_shoot.mjs`. Live rotation +
a real prod run are witnessed in the prod smoke (merge report).

## C2 — failure-copy pass (commit `f8f8327`)
Every agent-visible failure surface rewritten to house register (German, specific, next-step, no jargon):
- **Self-heal exhausted** — `healFailureReason`: "Das habe ich nicht hinbekommen: … Ich habe es 2× korrigiert
  versucht und dann gestoppt, statt dir ein falsches „fertig" zu melden. Deine Entwürfe sind gesichert — …"
- **Mixed-mode abort** — no "Tool"/"Turn" leaks; "Ich habe mich beim Ausführen … verheddert und lieber gestoppt …"
- **Parse abort** (C1) — "… hat auch nach einem Hinweis kein gültiges Werkzeug-Format geliefert. Ich habe nichts verändert."
- **Model-unavailable / #16 key-missing** — `humanizeModelError`: "Das Goblin-Modell ist gerade nicht verfügbar …
  Ich habe nichts verändert — bitte versuch es später noch einmal." (the fallthrough now reads honestly *in agent context*).
- **Budget-forced finish** — a card note (amber, not red): "Ich habe hier pausiert — das Budget … war erreicht.
  Dein Entwurf ist gesichert; schreib mir „weiter", …"
- Tool errors (file too big / not found / integrity "Fehlende Referenzen") and publish "Prüfung fehlgeschlagen …"
  were already humane from P0/P1 — left unified, verified in the sweep.
- DE+EN: server-emitted reasons are German (agent runs on the DE surface); client card copy is DE/EN via `t()`.
  Screenshots show the DE path; EN strings live beside each DE string in `AgentRunView.tsx`.
- Tests assert the new copy + the jargon-absence (`orchestrator.test.ts`).

## C3 — loading quotes (commit `005a273`)
- `apps/web/lib/loading-quotes.ts` — ~40 curated craft/building/tech quotes, **DE+EN**, one static module.
- Renders **below the live step** only during a streaming idle gap (>4s with no new real step), serif + faint
  + `opacity .85` — clearly secondary. Rotates every 7s. **Any new step clears it** (keyed on `steps.length`),
  so a quote never competes with — or masquerades as — a real step. Steps stay truth; quotes are decoration.
- **Founder-editable without a deploy?** No CMS mechanism exists in the app (established pattern is a static
  `lib/` module — see `greeting.ts`). Editing the array + redeploying the **web** app is the flow. Static file
  is the correct call here (a run-time content service would be new infra for 40 strings).

## C4 — report card & step polish (commit `7788f4f`)
- **Per-tool step icons** (`TOOL_GLYPH`): list `≣`, read `⌕`, write `✎`, save `▣`, publish `▲`, deploy-status `◈`,
  finish `✓`; a failed step stays red `✗` with an `aria-label` ("<tool> fehlgeschlagen"). The eye reads the KIND of step.
- **Elapsed formatting**: `fmtMs` gains minutes ("1m 3s"); the live header uses `fmtElapsed` ("12s" → "1:05").
- **Collapsed-by-default for runs >8 steps** once finished, header carries the **summary line** ("12 Schritte · 1m 3s");
  a manual toggle always wins (`toggledRef`).
- **Follow-ups at 375px**: Öffnen / Änderungen ansehen / Jetzt veröffentlichen render and wrap correctly at 375px
  (see `*_375.png`). Their handlers (`onOpen`→verified URL, `onViewChanges`→diff sheet, confirm-publish→publish-only
  resume) are the unchanged FEEL-3a/3b wiring in `SessionPane.tsx`; this unit only touched presentation.

## Gates
Full API suite **437/437**, agent suite **59/59**, `tsc --noEmit` clean (api + web). Screenshots at 375 + 1440,
light + dark, all five states legible and on-token in both themes.
