# Sprint 10.6-5 — Vercel Ownership UX

Date: 2026-06-03

Principle (Vincent): every Goblin user brings their OWN Vercel account. Goblin
pushes code via the user's token; deploys land in the user's account, their
domain, their bill. Goblin's `vinchafner2-1996` account is test-only. The UX must
make this unmissable so nobody assumes "Goblin hosts my site".

## Three touches (implemented)

### A — Onboarding Step 5 (Integrations)
`apps/web/app/welcome/integrations/page.tsx`
- Vercel card copy rewritten: "Deploys go to YOUR OWN Vercel account — your domain,
  your costs. Goblin doesn't host live sites for you. Free for personal projects."
- New full-width ownership callout under the Source-&-deploy section: shield icon,
  "You bring your own Vercel." explainer, and a **Create a free Vercel account →**
  button (opens `vercel.com/signup` in a new tab).
- (Page voice is English; copy matches it. German equivalents live in the deploy
  surfaces below.)

### B — Pre-deploy moment
- Backend (`vercel-service.ts`): the no-token error is now
  `NO_VERCEL_TOKEN — Du brauchst einen eigenen Vercel-Account (gratis). Token unter
  vercel.com/account/tokens erstellen und in Einstellungen → Konnektoren → Vercel
  einfügen.`
- Classic Code tab (`code-tab-classic.tsx` + `useCodeVercel`/`useCodeTab`): a deploy
  with no token raises `needsVercel`, which opens a friendly explainer modal:
  headline "Erstes Mal Live? Du brauchst einen Vercel-Account (gratis)", the
  ownership rationale, a 3-step list, and CTAs **Bei Vercel registrieren →** /
  **Habe schon einen Account → Token** / **Später**.
- Multi-session Code tab (`SessionPane.tsx`): strips the `NO_VERCEL_TOKEN —` marker
  and shows the plain German guidance toast.
- The standard Veröffentlichen confirm modal now also carries the italic line
  "Läuft über deinen eigenen Vercel-Account — deine Domain, deine Kosten."

### C — Settings → Konnektoren → Vercel
`apps/web/components/settings/ConnectorsPage.tsx`
- Always-visible italic gray note under the Vercel row: "Goblin pusht in deinen
  eigenen Vercel-Account. Deine Deployments, deine Kosten."

## Status
- Code + typecheck (web + api): green.
- Visual CDP verify: **could not run locally** (no Chrome remote-debugging port).
  Deferred to the founder's iPhone Max-walk.

## Founder live-verify
- [ ] Onboarding Step 5: Vercel card + ownership callout visible; "Create a free
      Vercel account" opens vercel.com/signup.
- [ ] Code tab, no Vercel token → Veröffentlichen → ownership explainer modal;
      "Bei Vercel registrieren" opens signup.
- [ ] Settings → Konnektoren → Vercel: italic ownership note present.
