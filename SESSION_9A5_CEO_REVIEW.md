# CEO Review — Goblin Design State (Iteration 2)

> **Reviewer:** Acting CEO of an AI-product company (ChatGPT-CEO-Persona).
> **Mandate:** Honest assessment. Does this look like a fundable, shippable product?
> **Date:** 2026-05-14

---

## Verdict

**Direction: YES. Speed: ACCEPTABLE. Quality: 8.5/10 on screen, 7/10 on substance.**

We are running in the right direction. We are not yet at 10/10, and pretending otherwise would be dishonest.

If this is what an investor sees in 2 weeks, I would not be embarrassed. I would also not bet my reputation on it without a few specific fixes. Below is what convinces me, what doesn't yet, and what would.

---

## What I see that convinces me

### Auth flow — 9/10
The split-screen layout with the moss-gradient brand panel and AES-256 trust indicator is the single most impactful change in this iteration. Linear and Vercel do exactly this. It tells me three things in the first 3 seconds:
1. Who you are (Goblin, builder tool)
2. Why it matters (3 value bullets)
3. That you respect security (AES-256, keys never leave)

OAuth-first ordering matches user behavior. Magic Link/Password toggle on a subtle segmented control feels like Stripe. The hover/focus states on inputs (3px moss glow) are exactly right.

**This is investor-ready.**

### Settings hierarchy — 9/10
The 5-group sidebar (ACCOUNT / AI / WORKSPACE / BILLING / ADVANCED) reads like Linear. Developer Tools correctly hidden under ADVANCED behind the feature flag. Appearance and Notifications as dedicated pages instead of stuffed into Account = mature product thinking.

**This is what a $20M ARR product looks like.**

### Landing footer & hero readability — 8.5/10
Footer now passes WCAG AA+ contrast. Hero is readable in sunlight. The new headline "Code from anywhere. Ship from your phone." is the first time we said something a real builder would tweet about. The previous "Cloud Workshop for Builders" was an MBA phrase, not a value proposition.

**This is shipping-quality marketing copy.**

### Workspace empty states — 8/10
Preview tab's 3-step guide (GitHub → Vercel → Auto-deploy) is excellent — it converts an empty page into onboarding. Code tab now teaches the "Send to Code" pattern, which is your actual differentiator.

**This is the kind of detail that retains users in week 2.**

---

## What does not convince me yet

### Real product substance vs. polish — 7/10
The chrome looks ready. I do not yet have proof the AI workflow itself is competitive with Cursor. Specifically:

- **Chat → Code → Preview loop:** I see the UI for it, but the brief mentioned the loop is what makes Goblin defensible. I want a Loom video of a real user doing it end-to-end in 90 seconds. If that exists and feels good, this is a 10. If it feels janky, the polished UI hides a hollow product.
- **BYOK encryption:** We claim AES-256. Is there a one-page security doc I can link investors to? Not yet.
- **Pricing:** Single $9 plan is brave. Brief mentioned 3-tier ($3–$39 geo-pricing). The disconnect between the marketing copy ("Power plan" mentioned in dashboard) and the actual pricing-section ($9 only) is a credibility risk on the data-room call. Pick one story and tell it consistently.

### Mobile UX — 6.5/10
We did not touch this in Iteration 2. The brief calls Goblin "mobile-first." Right now:
- Sidebar is a bottom-sheet drawer (good)
- FloatingToolbar exists but is not wired (Vincent-task from Session 9A)
- Workspace on phone with File Tree + Chat + Preview is unproven

This is the gap that scares me most. If "mobile-first" is the headline thesis, a 6.5/10 mobile experience is the thing that loses the deal.

### Auth Custom Domain — Blocker
`auth.justgoblin.com` is in Vincent's TODO. Until it's live, every OAuth user sees a Supabase URL post-login. That is a trust regression of 2-3 points. **This must ship before any investor demo.**

---

## What gets us to 10/10

Three things, in priority order:

### 1. Mobile workspace usability (+1.0 to overall)
- Wire the FloatingToolbar to the chat input
- Bottom-tab-bar instead of sidebar drawer on phone (Chat / Code / Preview / Sidebar)
- Test on iPhone with one-handed grip — is the send button reachable?

### 2. One real 90-second demo video (+0.5 to overall)
Loom recording: user opens iPad, prompts "build me a landing page for my dog walking business", sees code, deploys to Vercel preview, tweets the URL. Embedded on landing page, sent in cold emails, shown to investors.

### 3. Coherent pricing story (+0.3 to overall)
Either: ship the 3-tier with geo-pricing as designed in the brief, OR drop the multi-tier references from Account/Settings pages. The current state has both, which signals "we shipped a marketing page and a product separately."

---

## Direct answer to Vincent's question

> "Wie zufrieden wärst du als ChatGPT CEO?"

**Zufrieden:** Yes. We are clearly moving from MVP to product. The visual quality jumped from 6/10 to 8.5/10 in one session. That is a real, measurable result.

**Auf Niveau Claude/ChatGPT/Cursor/Linear/Vercel?** Not yet — those teams have 20-50 designers and 5+ years. We are a solo founder with AI assistance, and **we are within 1.5 points of them on visual chrome.** That is remarkable. The remaining gap is in:
- Real product fluency (the 90-second demo bar)
- Mobile execution (the headline thesis)
- Pricing/data-room coherence

**Würde ich uns Series-A-ready nennen?** With the three fixes above, **yes**. Without them, we are pre-seed quality with great taste.

---

## What I would tell my board

> "We hired a strong design sensibility into the codebase this week. The auth page, settings architecture, and landing hero now look like real product. Three items remain before I'd let us into a serious VC conversation: mobile workspace polish, a demo video, and pricing consistency. ETA on those: one focused week."

**Score: 8.5/10. Direction: correct. Next milestone: 9.5/10 with the three fixes above.**

Not pretending we are at 10/10. **Pretending we are at 10 would be the single most expensive mistake we could make in a fundraising conversation.** Investors smell that. They reward the founder who says "8.5, here are the three things to get to 10, here is the ETA."

That is who we are now.

— Acting CEO
