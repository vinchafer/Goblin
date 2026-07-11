# A-3 · Runtime smoke after publish — spike + decision (HALT)

**Goal:** after the publish truth-gate passes, verify the app actually RUNS — page loads
headlessly, zero console errors, one basic interaction — and feed a failure into the
agent's self-heal on the NEXT run (not auto-run). Result attached to the deploy record +
report card ("Funktionsprüfung: ✓ / Konsolenfehler gefunden: …").

**Outcome: HALT this unit** with the table below and a recommendation. The stated gate
("fixture app with a deliberate console error → smoke catches it") **requires JavaScript
execution**, which only options (a) or (b) provide — and both trip the escalation guard.
Shipping browser infra I cannot verify runs on the real Railway service from this cloud
sandbox would be a false "it works" claim. Founder picks the path; then it's one unit.

## What already exists (the floor is built)

`verifyDeployment` (`apps/api/src/services/deploy-verification.ts`) already runs post-build
and does the **fetch-based** half of option (c): the entry HTML answers 200 **and every
referenced asset answers 200** (the n/6 truth-gate). So "is it reachable + are its assets
served" is covered today. What is NOT covered: executing the page's JS to catch **runtime**
/ **console** errors and drive one interaction. That is the delta A-3 asks for.

## Decision table

| Option | Mechanism | Catches console/runtime errors? | Infra cost | Escalation | Verdict |
|---|---|---|---|---|---|
| **(a) Playwright + Chromium in the API/Railway job** | Launch headless Chromium post-publish, load the verified URL, collect `console`/`pageerror`, click one selector | ✅ yes (the real thing) | Chromium ≈ +300 MB image, apt/nix deps, higher cold-start + memory on the existing API service; needs an async job so it never blocks the deploy response | **HIGH** — real dependency + runtime change I **cannot verify from this sandbox** actually boots on Railway (memory/cold-start unknown). Not "no new services" in spirit. | **Recommended path, but founder-gated** — do NOT ship blind |
| **(b) External headless API (Browserless / ScrapingBee / etc.)** | POST the URL to a hosted headless browser, read back console errors | ✅ yes | New paid vendor + API key + egress | **HIGH** — new paid service, against the "no new paid services" law | **Rejected** unless founder explicitly wants a vendor |
| **(c) Lightweight fetch + parse (no JS execution)** | Already have it: fetch entry + assets, 200-check, optional HTML sanity parse | ❌ no — cannot run JS, cannot see `console.error` | ~0 (exists) | none | **Insufficient for the gate** — this is the current `verifyDeployment`; extending it with static HTML lint is possible but still fails the "deliberate console error" gate |

## Recommendation (for the founder to greenlight, then a follow-up unit builds it)

1. **Path (a)**, as an **async, non-blocking** job: after a green publish, enqueue a smoke
   task (not in the request path). It launches headless Chromium, loads the verified URL,
   captures `page.on('console'|'pageerror')`, performs one generic interaction (first
   `button`/`a`), and writes a structured result to the deploy record.
2. **Report card line:** `Funktionsprüfung: ✓` or `Konsolenfehler gefunden: <first error>`
   — honest, never blocking the publish that already passed the reachability gate.
3. **Self-heal wiring:** a failed smoke is surfaced to the agent on the **NEXT** run as
   context ("letzte Funktionsprüfung meldete: …"), matching the FEEL-3b bounded self-heal —
   never auto-run, never an infinite loop.
4. **De-risking (a):** prove it on Railway first — a throwaway job that boots Chromium and
   reports memory + cold-start on the real service. If it doesn't fit the API service,
   run it as a **separate small worker** (that IS a new service → founder decision).

**Why HALT and not build now:** the gate needs JS execution; the only mechanisms that
provide it (a/b) carry infra/vendor decisions with escalation flags, and (a)'s Railway
runtime is **unverifiable from this cloud session**. Building it blind would risk a
"Funktionsprüfung works" claim I can't stand behind. Everything below the JS-execution line
(reachability + asset checks) already ships via `verifyDeployment`.
