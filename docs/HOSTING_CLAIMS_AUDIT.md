# Hosting-Claims Audit — every place the repo says "Goblin does not host"

**Created: 2026-07-28 · AKT 2 · Pre-Phase-2 (U-B1).**
Scope of the sweep: `apps/`, `packages/`, `docs/` — legal pages, i18n dictionaries,
help/FAQ corpus, onboarding copy, product copy, internal docs.

> **Line numbers are as of 2026-07-28 and have since drifted** (checked 2026-08-13, Act-2
> consistency sweep). The *file* in each row is still the right file; grep the quoted string
> rather than trusting the `:NN`. The claims and their statuses were re-checked and are correct
> — the one row that had changed is S5, now stamped below.

## Why this file exists

From Phase 2 onward Goblin publishes user apps to `https://{name}.justgoblin.app` on a
platform-owned Cloudflare plane (router Worker + R2 + KV). Until now every user-facing
surface asserted the opposite — that Goblin *never* hosts user content publicly, and that
the user's own Vercel account is the only live target. Those assertions become false the
moment Phase 2 ships to the first beta account.

This inventory is the complete list, so nothing is silently left behind. Each entry is
classified:

- **[HARD]** — an absolute claim ("never", "not", "keine"). False once hosting ships.
  Fixed in this PR.
- **[SOFT]** — describes the Vercel path as *the* path. Accurate today for every
  non-beta account; becomes incomplete rather than false. Fixed where it sits on a legal
  surface, otherwise listed here for Phase-2 GA.
- **[GAP]** — something missing rather than wrong. Escalated, not edited (see below).

---

## [HARD] Absolute claims — false once hosting ships

| # | Location | Claim | Status |
|---|---|---|---|
| H1 | `apps/web/app/(legal)/acceptable-use/page.tsx:55` | „Goblin hostet deine Inhalte nicht öffentlich." | Replaced (U-B3) |
| H2 | `docs/ACCEPTABLE_USE_POLICY.md:22` | „Goblin hostet Nutzer-Inhalte NIE öffentlich." — the structural premise the whole AUP liability argument is built on | Replaced (U-B3) |
| H3 | `docs/ABUSE_RESPONSE.md:14` | „Goblin hostet Nutzer-Inhalte nie öffentlich." — opens „Der strukturelle Vorteil" | Replaced (U-B4) |
| H4 | `packages/shared/src/help-content.ts:115` | Heading „Goblin hostet nicht — dein Vercel hostet" / "Goblin doesn't host — your Vercel does" | Rewritten (U-B5) |
| H5 | `packages/shared/src/help-content.ts:117-118` | „Goblin betreibt deine Seite nicht selbst." / "Goblin does not run your site itself." | Rewritten (U-B5) |
| H6 | `apps/web/app/welcome/_components/i18n.ts:388` | „Goblin hostet keine Live-Seiten für dich." | Rewritten (U-B5) |
| H7 | `apps/web/app/welcome/_components/i18n.ts:649` | "Goblin doesn't host live sites for you." | Rewritten (U-B5) |

`docs/OPS_SPIKE_0_DECISION_TABLE.md:116, :351, :486` already flagged H1–H3 as the blocker
to resolve before Phase 2. This PR is the resolution; the decision-table entries are left
as the historical record and are not edited.

## [SOFT] Vercel-as-the-only-path copy — accurate today, incomplete at GA

Enforcement copy on a legal surface (fixed in this PR because it names the wrong party):

| # | Location | Note |
|---|---|---|
| S1 | `apps/web/app/(legal)/acceptable-use/page.tsx:107` | Consequences name „Meldung an den Hosting-Provider (Vercel)" as the only takedown route. For a Goblin-hosted app, Goblin *is* the host. Fixed (U-B3). |
| S2 | `apps/web/app/(legal)/acceptable-use/page.tsx:165` | Same claim, EN. Fixed (U-B3). |
| S3 | `docs/ABUSE_RESPONSE.md:60-61, :82-84` | „Goblin kann den Nutzer sperren, aber nicht dessen Vercel-Deployment löschen" — true for the Vercel path, false for the Goblin-hosted path. Fixed (U-B4). |

Product/onboarding copy left as-is — still correct for the default (non-beta) path, to be
revisited when hosting leaves beta:

| # | Location | Note |
|---|---|---|
| S4 | `apps/web/components/code/VercelConnectSheet.tsx:80-86` | "connect your Vercel account once" — the Vercel path still exists and is still the default. |
| S5 | `apps/web/components/code/VercelConnectSheet.tsx` (now :10–16) | ~~Stale comment citing the **2026-07-07 founder decision** "Goblin does NOT host".~~ **CORRECTED in this same PR (U-B1/S5)** — the comment now carries a `SUPERSEDED PREMISE` block naming the 2026-07-11 reopening and the Phase-2 hosting path. Comment only; the sheet's behaviour and user-visible text are unchanged, which is also why the file's diff stayed empty through all of Phase 3. |
| S6 | `apps/web/components/settings/ConnectorsPage.tsx:263, :290` | „Goblin pusht in deinen eigenen Vercel-Account." Accurate for the Vercel connector. |
| S7 | `apps/web/app/welcome/_components/i18n.ts:380, :641` | „Du bringst dein eigenes Vercel mit." Accurate as the default onboarding path. |
| S8 | `apps/web/app/welcome/integrations/page.tsx:120, :140` | "bring your own Vercel" explainer. |
| S9 | `apps/web/components/project/code-tab-classic.tsx:149` | Same explainer, no-token branch. |
| S10 | `apps/web/hooks/code/useCodeVercel.ts:10` | Same explainer, error branch. |
| S11 | `apps/web/components/preview/preview-tab.tsx:250-251` | Vercel Deployment-Protection hint. Vercel-specific by nature. |

## [GAP] Missing — escalated to the founder, deliberately NOT edited here

| # | Location | Gap |
|---|---|---|
| G1 | `apps/web/app/(legal)/privacy/page.tsx` | ~~The sub-processor list has **no Cloudflare entry**.~~ **CLOSED 2026-07-28 on founder authorisation.** Cloudflare added to the sub-processor list, DE + EN: purpose (hosting and delivery of user-published apps), services (Workers, R2, KV), and the region facts *as verified* — R2 configured in the EU jurisdiction (endpoint `<hash>.eu.r2.cloudflarestorage.com`, bucket `goblin-apps`, per `evidence/akt2-phase1/roundtrip-local-2026-07-28-r2-3of3.README.md`), while Workers and KV are explicitly described as globally distributed rather than EU-confined. |
| G2 | `apps/web/app/(legal)/terms/page.tsx` (whole file) | The ToS page is **English-only**, while the AUP page is bilingual DE+EN. Pre-existing parity gap. The new hosting section (U-B2) ships DE+EN; the six pre-existing sections are left untouched — translating existing terms would change liability wording that was not in scope. Founder decision. |
| G3 | `apps/web/app/(legal)/privacy/page.tsx`, `imprint/page.tsx` | Also English-only / mixed. Same pre-existing gap as G2, same reasoning. |

## Founder decisions applied (2026-07-28)

- **Termination grace period: 30 days** — confirmed; the drafts already said 30 days
  (ToS §7, DE and EN). No change was needed.
- **Abuse contact: `support@justgoblin.com`** — the existing, monitored mailbox, chosen
  over inventing a new `abuse@`-style address that nobody reads. Every occurrence across
  the legal pages, the footer, the AUP and the runbook now points there; a repo-wide grep
  for the previously drafted `abuse@` address returns **0 hits**.
- **Cloudflare sub-processor entry: authorised and added** — closes G1 above.

## What was checked and found clean

- No uptime, SLA, availability-percentage, or backup **guarantee** exists on any
  user-facing legal surface today. Sweep over `apps/web/app/(legal)/**`,
  `apps/web/app/status/**` and `packages/shared/src/help-content.ts` for
  `SLA|uptime|Verfügbarkeit|99.[0-9]|Backup-Garantie|backup guarantee|garantiert|guarantee`
  returned exactly three hits, all in `apps/web/app/status/page.tsx:25, :92, :151` — and
  all three are the *measured* process uptime rendered from `/health`, i.e. a reported
  observation, not a promised level. Nothing had to be walked back; the new text simply
  must not introduce a guarantee.
- `apps/api/src/**` hosting references are all the Phase-1 kill-switch / allowlist
  machinery (`OPS_HOSTING_ENABLED`, `ops-beta.ts`, `ops-gate.ts`), not user-facing claims.
