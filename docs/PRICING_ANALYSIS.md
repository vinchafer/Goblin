# Goblin — Pricing Analysis
**Phase A output | 2026-05-11 | Binding until Phase 3 / 100 paying users**

---

## 1. Three Models Compared

### Model A — One Plan $12/mo (KISS)

| | |
|---|---|
| Price | $12/mo (or $9/mo at launch, ramp to $12 at scale) |
| What's included | Everything in Phase 1-2: unlimited projects, BYOK all providers, Chat + Code + Preview, GitHub push, 5GB storage, web push |
| Who decides | No decision needed. One button. |

**Pros for Goblin specifically:**
- Zero decision fatigue — "is Goblin worth $12?" not "which plan do I need?"
- No upsell anxiety (user never wonders if they're on the wrong tier)
- Support is dead simple — every user has same features
- Conversion funnel: trial → pay, not trial → plan-picker → confusion → abandon
- Matches ARCH v6 explicit decision: "no pricing tiers until 100 paying users"
- 10,000 users × $12 = $120k MRR. Still mass-market.

**Cons:**
- Power users (200 requests/day, 5 BYOK keys) get same deal as casual users — theoretically underpriced
- No upsell motion once subscribed
- Leaves revenue on table from Forge-equivalent users

**Realistic conversion:** 8-12% trial-to-paid at $12 (similar to Lemon Squeezy tools, early-stage SaaS under $15)

---

### Model B — 3 Tiers $9/$19/$39 (Tier Discrimination)

| | Seed $9 | Craft $19 | Forge $39 |
|---|---|---|---|
| Storage | 5GB | 20GB | 100GB |
| BYOK slots | 2 | 5 | Unlimited |
| Priority | Standard | + Priority | Top priority |
| Support | Discord | Email | Priority 24h |

**Pros:**
- Captures willingness to pay from power users
- Upsell motion exists (Seed → Craft when hitting limits)
- Standard SaaS pattern (easy to understand)

**Cons for Goblin specifically:**
- Currently ZERO data on what "hitting limits" means — Seed limits ($9 plan) will be guesses
- Decision fatigue kills conversion: "2 BYOK slots enough? What does Priority Queue mean?"
- Support complexity: 3 × different bugs / "but I'm on Craft..."
- If BYOK is free-for-all on all tiers, what does the tier actually gate?
- Pre-GPU-launch (Phase 1-2), "Priority Queue" is fake — there IS no queue
- ARCH v6 explicitly delays this to Phase 3+

**Realistic conversion:** 6-9% (tier confusion adds ~2-3pp friction loss)

---

### Model C — Freemium Mobile + 1 Pro Plan $15 (Funnel)

| | Free | Pro $15/mo |
|---|---|---|
| Local mode | ✓ Desktop (Tauri, Phase 3) | ✓ |
| Cloud mobile | 10 req/day | Unlimited |
| BYOK | ✗ | ✓ |
| GitHub push | ✗ | ✓ |
| Storage | ✗ | 5GB |

**Pros:**
- Lowest barrier to entry — free users can try, not just trial
- Local mode (Phase 3) as free-forever acquisition channel
- Strong referral/virality potential

**Cons for Goblin specifically:**
- "10 req/day" limit requires enforcement logic, quota resets, edge cases
- Free users use support, create DB rows, get push notifications — all cost money
- Without Phase 3 GPU, local mode doesn't exist yet — Freemium half-breaks
- Forces BYOK behind paywall, but BYOK is Goblin's core value prop Phase 1
- Complex billing: who has BYOK? Who upgraded? Pro-rated cancellations?
- Indie tool Freemium typical conversion: 2-5% — would need 200k+ free users to hit meaningful revenue

**Realistic conversion:** 3-6% (much lower intent at signup)

---

## 2. Recommendation: Model A — One Plan at $9/mo launch

**Why $9 not $12:**
- DACH + mass market primary: €8.xx feels trivially cheap ("cheaper than Spotify")
- $9 is below the psychological "is this serious money?" threshold
- Ramp to $12 at 500+ users when retention data confirms value — grandfathered existing users

**Why Model A over B and C:**

The single biggest risk for Goblin Phase 1-2 is **conversion friction**, not revenue maximization. With 8-15% typical indie tool conversion:
- At $9 × 8% of 1,000 signups → $720/mo (covers Phase 1-2 fixed costs of ~€160 immediately)
- At $9/$19/$39 × 6% → possibly more money per user, but fewer conversions, more support

Model C fails because the BYOK core value prop can't be gated behind paywall — that's the primary reason to use Goblin Phase 1 (no GPU yet). Giving away BYOK for free means Model C has no meaningful upgrade hook until Phase 3.

Model B fails because the tier discriminators (Priority Queue, extra BYOK slots) don't exist meaningfully until Phase 3. We'd be selling tiers based on features we haven't built.

**ARCH v6 §10 binding decision:** "No pricing tiers until 100 paying users and real usage data."

---

## 3. Implementation Plan

### Stripe Changes Required
- Keep existing Price IDs for Seed/Craft/Forge (don't delete — existing users may exist)
- Create NEW Price ID: `STRIPE_PRICE_ONE` at $9/mo
- In UI: show only ONE plan. Hide tier comparison table.
- In trial-gate middleware: any active subscription = full access
- Billing settings page: "Your plan: Goblin Pro — $9/mo" with Stripe Portal link

### DB Changes
- `users.plan` column currently ENUM seed/craft/forge
- New subscribers: set plan = 'seed' (maps to $9 plan, works with existing schema)
- No migration needed — 'seed' already exists

### UI Changes (Phase G)
- `/pricing` page: one price card, not three
- Landing pricing section: simplify
- `/dashboard/settings/billing` page: show "Goblin Pro $9/mo — Manage subscription"
- Trial banner: "Day X of 3 — Upgrade for $9/mo →"
- Remove confusing plan comparison from upgrade page

### What NOT to change
- Existing Stripe Price IDs for Seed/Craft/Forge (don't break existing subs)
- DB schema (seed maps fine to $9/mo)
- Billing webhook handler (plan=seed already handled)

---

## 4. Trial Structure

**3-day cloud trial** (Cloud mode only, Local = never needs trial per ARCH §8):
- Day 1-3: Full access, trial banner prominent
- Day 4: API blocked, upgrade CTA — clear message, not silent failure
- 1× "Extend 2 days" button (used once, stored in `trial_extension_used`)
- After extension: day 6 = hard paywall

**Free forever:** Local mode (Tauri Desktop, Phase 3). Not during Phase 1-2 web-only.

---

*Sign-off: Implement Phase G based on this recommendation. One plan, $9/mo, trial 3 days.*
