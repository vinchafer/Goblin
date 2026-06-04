# Pre-R5 Final Gate

Date: 2026-06-04 · prove prod routes direct by a REAL generation · ~40min · no code changes

Driven on PROD (`https://goblin-web.vercel.app`) via CDP, logged in as the test
account **vinc.hafner3** (greeting "HI, VINC.HAFNER3" — NOT Vincent's personal
account). Chrome launched with `--remote-debugging-port=9222`.

---

## GATE 1 — REAL GENERATION ON PROD — **PASS** ✅

Prompt: `eine einfache HTML landing page für einen newsletter`
Model: **Llama 3.3 70B (Groq)** — the dashboard default, the working provider.

- **Streamed?** YES — tokens appeared progressively; the send button switched to a
  stop-square during streaming, then back to the arrow on completion.
- **Output landed?** YES — a full valid HTML document streamed and completed:
  `<!DOCTYPE html>`, `<html lang="de">`, head with charset/viewport, `<title>`,
  a `<style>` block (body/.container/h1 with real CSS), `<body>` with a newsletter
  form. Clean, complete, no truncation.
- **Error?** NONE. No hang, no 400, no "model not found", no proxy error, no
  watchdog timeout. (An automated body-text scan flagged "error/400" — a FALSE
  POSITIVE matching `max-width: 400px` / `rgba(...)` in the generated CSS; the
  screenshot shows a clean completed generation.)
- Repeated cleanly a second time in a project chat (index.html / styles.css /
  script.js).
- Screenshot: `sprint-10-9/PRE_R5_gate1_groq_generation.png`.

**Proven answer:** a real Groq generation on prod **routes to a live provider and
streams clean**. A dead-proxy config would have hard-failed at
`model-router.ts:375-382` (proxy 400 is not a soft error → throws). It did not.
→ **prod routes DIRECT. Vincent's Railway `LITELLM_BASE_URL` removal worked. R5
generation is SAFE.** This answers the one question that had gated R5.

---

## GATE 2 — REAL PUBLISH — **PASS** ✅

Prior assumption ("test account has no Vercel token") was **wrong**: a read-only
`byok_keys` check shows vinc.hafner3 has an **active `vercel`** key. So GATE 2 was
run for real, not deferred.

Flow: project chat generated index.html + styles.css + script.js (Groq) → the
multi-file **"An Code senden"** preview correctly split all 3 files (NEU) → "Alle
senden" wrote them to the project → **Sichern** → **Veröffentlichen** ("Das baut
dein Projekt und stellt es unter einer öffentlichen URL bereit").

- Editor showed **"Veröffentlicht"**; a fresh production alias appeared.
- Opened the live URL in a clean tab:
  **`https://test-vincent-vincent-2-s-projects.vercel.app/`**
  - HTTP page loads, title "🟢 Newsletter".
  - **No SSO / Vercel Authentication wall** (programmatic check: `sso=false`).
  - **No 404** — renders the real content: `<h1>Abonnieren Sie unseren Newsletter</h1>`,
    e-mail input + "Abonnieren" button + description.
  - Screenshot: `sprint-10-9/PRE_R5_gate2_public_deploy.png`.

→ The 10.9-6 Vercel zero-config public publish **works end-to-end**: the deploy
produced a **public** production alias (the ssoProtection→public path held), and
"Öffnen" resolves to it (no login wall, no 404 — the 10.8 Öffnen-404 fix holds).

Minor note (NOT a gate failure): the published page is unstyled because the
Groq-generated HTML links `href="style.css"` while the emitted file is `styles.css`
— a generation-quality typo, not a deploy/routing issue. The page is public and
renders.

Cleanup: files + one deploy were added to the **pre-existing** test project
"Test Vincent" under the test account — left in place (not a fresh throwaway; the
public deploy is harmless and useful as a reference).

---

## FINAL LINE

**GREEN — R5 is safe to walk now.** A real Groq generation streams clean on prod
(routing is direct; the dead proxy is gone), AND a real publish produces a public,
SSO-free, non-404 live URL. Both gates proven on prod under the test account, with
screenshots — not assumptions.

Headline for Vincent: **yes — pick up your phone, a Groq generation works on prod
right now, and publish gives a public link.**
