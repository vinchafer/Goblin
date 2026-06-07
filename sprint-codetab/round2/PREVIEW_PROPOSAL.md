# Preview & Publish-Visibility — Design Proposal (BUG-10)

**Status:** PROPOSAL ONLY — not implemented. Touches the publish/deploy loop, which is
under a hard no-touch guard this round. Needs founder sign-off before any build.

Date: 2026-06-07 · Author: Round-2 agent · Surface: `components/preview/preview-tab.tsx`,
`apps/api/src/services/vercel-service.ts`, deploy flow.

---

## 1. Feasibility finding (the part I was asked to investigate)

The task framing assumed *"published sites are protected by Vercel Deployment Protection;
the in-app iframe gets 401."* That is only **half** true today, and the truth changes the
recommendation.

**What the loop actually does now** (`vercel-service.ts:31 disableDeploymentProtection`,
called from `createDeployment` at line 157): on every publish Goblin PATCHes the user's
project with `{ ssoProtection: null }` using the user's own token — i.e. it **actively
tries to make the deployment world-public by default**. It returns:

- `'public'` when the PATCH succeeds (200) → the production alias `<project>.vercel.app`
  is anonymously reachable → **the in-app iframe renders fine.**
- `'manual'` when the token lacks scope or it's a team project (403/404 on personal +
  all team scopes) → protection stays on → **anonymous iframe gets 401 / broken-doc icon.**

So the broken preview is **the `'manual'` failure branch**, not the default path.

### Why "Protection Bypass for Automation" is the wrong fix here

The recommended approach (apply a Vercel automation-bypass secret to the iframe only) is
**not safely buildable without touching the loop**, for three reasons:

1. **It contradicts the loop's current stance.** The loop already removes protection. To
   use a bypass secret we would first have to *re-enable* protection and then thread a
   secret — a direct change to `disableDeploymentProtection` / `createDeployment`. That is
   exactly the publish loop the guard forbids touching.
2. **It leaks the secret to the client.** `?x-vercel-protection-bypass=<secret>` in the
   iframe `src` ships the bypass secret in client HTML. Anyone who opens devtools on the
   Goblin app gets a key that unlocks **every** deployment of that project. That is not
   "protected from the public" in any meaningful sense.
3. **Enabling the bypass is a per-project Vercel setting** that must be provisioned via the
   Vercel API at deploy time → again, inside the deploy flow.

**Conclusion: do not build the live bypass.** The honest lever is to give the user an
explicit *visibility choice* and make the loop's already-public default a conscious one.

---

## 2. Proposal: pre-publish visibility dialog (first deploy only)

Before a user's **first** deploy on a project, show a small modal:

```
Projekt veröffentlichen

Name:  [ my-landing-page              ]   ← editable slug, validated for Vercel

Sichtbarkeit:
  (•) Nur ich        — protected; nur du (eingeloggt bei Vercel) siehst es
  ( ) Per Link       — bypass-Token-Link, teilbar, nicht indexiert
  ( ) Öffentlich     — jeder mit der URL; für eine echte Live-Site

[ Abbrechen ]                         [ Veröffentlichen → ]
```

- Choice is stored on the project (`projects.visibility`) and reused on later deploys
  (changeable in project settings).
- **"Nur ich"** → loop does NOT disable protection; the in-app preview uses an
  *owner-scoped, server-side-fetched* render (the API, holding the token, fetches the
  deployment HTML and streams it to the iframe via a same-origin Goblin route — the secret
  never reaches the client). This is the only way to keep it truly private *and* visible
  in-app.
- **"Per Link"** → loop enables automation-bypass and Goblin builds a tokenized share URL.
  Secret lives in the URL the user chooses to share, not in app source.
- **"Öffentlich"** → today's behavior (`ssoProtection: null`).

### Why this needs the loop (and thus sign-off)

Every branch above changes `createDeployment` / `disableDeploymentProtection` behavior and
adds a server-side preview-proxy route. All loop-adjacent. Hence: proposal, not a build.

---

## 3. Safe interim (no loop touch) — recommended to ship separately

Until the above is signed off, the preview tab should never strand the user at a
broken-doc icon when a site is in the `'manual'` (still-protected) state:

- Surface deploy `protection` state (`'public' | 'manual'`, already returned by the loop)
  to the preview tab via the existing project/preview payload (read-only; no loop change).
- When `protection === 'manual'`: instead of a bare iframe that 401s, show an honest panel:
  *"Deine Vercel-Seite ist noch geschützt (Vercel Authentication). Öffne sie hier — du bist
  bei Vercel eingeloggt — oder schalte Deployment Protection aus, um sie zu teilen."* with a
  prominent **In Vercel öffnen** button (owner is authenticated → sees it).

The current preview already carries a generic SSO hint + an open-in-tab link; this just
makes it conditional and prominent instead of letting the iframe fail silently. This is a
**read-only** consumer of loop output and can ship without sign-off — flagged here so the
founder can green-light it independently of the bigger visibility work.

---

## 4. Recommendation

1. **Now:** ship the §3 interim (read-only; honest protected-state panel). 
2. **After sign-off:** build §2 (visibility dialog + server-side private-preview proxy +
   loop branching). This is the real fix and the right place to decide what "published"
   means by default — which today silently means "world-public".
