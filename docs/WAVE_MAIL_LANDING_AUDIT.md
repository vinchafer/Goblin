# WAVE — Mail-Zustellbarkeit + Landing-Ehrlichkeit

**2026-08-17 · branch `claude/mail-landing-audit-kufuha` (from `master` @ `e822c37`)**
**Trigger:** first real test cohort. (a) A friend's signup confirmation landed in his
JUNK folder. (b) An expert tester documented that the landing promises things the
product delivers differently.

Scope: landing + mail + docs. No app/chat/agent code touched — a parallel session
owns truncation, preview removal and dark contrast.

---

## 0 · State-first — where the prompt and the repo disagreed

Law 10 says the repo is the truth and the prompt is a plan. Two of this wave's
premises did not survive contact with reality, and both change the verdict:

| Prompt said | Reality (2026-08-17) | Consequence |
|---|---|---|
| "DMARC was deliberately left unset weeks ago." | `_dmarc.justgoblin.com` **exists**: `v=DMARC1; p=none;` — confirmed on two independent resolvers. | DMARC is not the missing layer. What is missing is `rua` — the record publishes a policy nobody can observe. Founder action #1 changed from "set DMARC" to "make DMARC observable". |
| The landing "shows a *send to preview* button that does not exist". | The Send-to-Code section shows **"An Code senden"**, which does exist (`CodeBlock.tsx:102`). The actual preview promise is elsewhere: **IslandFlow step 08, "Preview — see your live site the moment it ships"**. | Fixed the real one. Also found a genuinely invented affordance in the same section the tester flagged: a "Draft · 2 files" pill the product does not have. |

---

## 0b · Re-check against what merged after this report (2026-08-17, evening)

This report was written against `master` @ `e822c37` and merged as PR #103
(`84dbd58`). PR #104 (`33ad3a8`) landed after it — the parallel session's wave:
truncation recovery, **preview removal**, dark-contrast audit. Every claim below
was re-read against `33ad3a8` before the carry-forward was filed, because a report
that outlives its own refutation is the failure class this strand keeps paying
for. What changed:

| Claim in this report | Status against `33ad3a8` |
|---|---|
| Claim-table row 16: the landing's preview promise is deleted while removal is "in flight" | **Now settled, row updated.** `components/preview/` is deleted and `preview-removed.test.tsx` guards it. Landing and product agree; nothing to re-cut. |
| §2.4 audit: `layout/Header.tsx` line refs (rows 1-4) | **Drifted, corrected.** PR #104 edited `Header.tsx`; every cited line moved up by 5-19. The affordances themselves are unchanged — re-found by content, not by line. |
| §2.4 row 23: `design-tokens.css:123` | **Drifted, corrected** to `:133`. The value is still 20px. |
| §2.4: `chat/ChatInput.tsx` and `header/AvatarMenu.tsx` refs | **Unchanged** — re-verified, all still exact. |
| §2.4: `app/dashboard/page.tsx` refs (rows 6-8, 14-22) | **Unchanged** — PR #104 did not touch the dashboard. |
| The ported mock's hardcoded production palette | **Not superseded.** PR #104's token work is entirely in the DARK blocks; every light value `PhoneMock` pins (`--ink-1/2/3`, `--gold-700`, `--gold-deep`, `--d-surface*`, `--accent-soft/-rule`, `--brand-header`) is byte-identical on `33ad3a8`. |
| §2.3 / §2.4: the chat code-block is the one German-only surface, and is no longer depicted | **Still true.** `CodeBlock.tsx` is untouched by PR #104 — still no i18n import, still `Kopieren` (:83) and `An Code senden` (:102). Carried forward as **L1**. |
| Gates table | **Historical, unchanged** — those numbers belong to this wave's own runs and are stamped as such. Master's own E2E on `33ad3a8` (run `32082525114`) is green, so the landing suites this wave added still pass after PR #104. |
| §1 (the whole mail chain) | **Untouched by PR #104** — no DNS, no Resend, no auth-mail code in that wave. Every verdict stands as written. |

---

# UNIT 1 — Mail deliverability, chain by chain

## 1.1 Verdict table

Every row re-verified from outside this repo today; nothing carried over from the
earlier "DKIM/SPF green" check.

| Layer | Verdict | Evidence |
|---|---|---|
| **SPF (envelope domain)** | **PASS** | `send.justgoblin.com TXT = v=spf1 include:amazonses.com ~all`, and `send.justgoblin.com MX = 10 feedback-smtp.eu-west-1.amazonses.com` — the signature of a Resend **custom MAIL FROM**. The envelope-from is therefore on `send.justgoblin.com`, and SES's IPs are authorised for it. |
| **SPF (From-header domain)** | **soft-fail if a receiver checks it** | `justgoblin.com TXT = v=spf1 include:_spf.mx.cloudflare.net ~all`. That is Cloudflare Email Routing's **inbound** record; it does not authorise Resend/SES. Modern receivers evaluate SPF against the envelope domain, so this is not the failure — but a receiver doing a From-domain "best guess" check gets `~all` → softfail. Optional hardening below. |
| **SPF alignment (DMARC)** | **PASS, relaxed** | Envelope `send.justgoblin.com` vs From `justgoblin.com` → same organizational domain. Aligned under `aspf=r` (the default, and we set no `aspf`). Would **fail** under `aspf=s` — so do not set strict alignment. |
| **DKIM** | **PRESENT, aligned** | Selector `resend` published on **both** `justgoblin.com` and `send.justgoblin.com`. Resend signs `d=<From domain>`, giving strict-and-relaxed alignment with the From header. |
| **DKIM key strength** | **weak-but-accepted** | The key blob begins `MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ…` = **1024-bit RSA**. Accepted everywhere; 2048 is the current recommendation. Resend controls this key, so rotating it is a Resend-side action, not a DNS edit. |
| **DKIM record syntax** | **OK** | The record carries `p=` with no `v=DKIM1;`. RFC 6376 §3.6.1 makes `v` RECOMMENDED with default `DKIM1`, so verifiers accept it. Not a defect; do not "fix" a Resend-managed record. |
| **DMARC** | **PRESENT but blind** | `v=DMARC1; p=none;` — no `rua`, no `sp`, no `pct`. The policy exists (which is what Gmail/Yahoo's 2024 sender rules require) but **no report ever reaches the founder**, so nobody can see whether real mail authenticates at real receivers. → founder action #1. |
| **Return-Path / bounce domain** | **PASS** | `send.justgoblin.com`, with the SES feedback MX in place, so bounces and complaints return to Resend rather than nowhere. |
| **Reply-To** | **was absent** | Auth mail sent no `Reply-To`, so a reply goes to `noreply@justgoblin.com`. Now settable via `AUTH_REPLY_TO`, deliberately unset until it points at a mailbox someone reads. |
| **Message-ID / Date** | **PASS (delegated)** | Neither is set by our code, which is correct: Resend/SES generate both. The hook passes only `from/to/subject/html/text`, so there is nothing for us to get wrong here. |
| **Content: multipart** | **WAS FAILING → fixed** | The mail went out **HTML-only**. That is the one content property a filter can score with certainty (SpamAssassin `MIME_HTML_ONLY`). A hand-written plain-text part now ships with every auth mail. |
| **Content: link density** | **WAS WEAK → fixed** | Signup mail before: 234 visible words, **7 anchors over 4 URLs** (the action URL appeared 4×, once as a button and once as a raw fallback, per language) = 33 words/anchor. After: 231 words, **5 anchors over 3 URLs** = 46 words/anchor. |
| **Content: subject** | **WAS WEAK → fixed** | `Bestätige deine E-Mail-Adresse · Confirm your email address` — 58 chars, no sender name, phishing-shaped. Now `Goblin — E-Mail bestätigen · Confirm your email` (46 chars, brand first). |
| **Content: images/pixels** | **PASS** | Zero `<img>`, zero tracking pixel, zero redirect wrapper, zero remote asset. Every `href` is `https://` on `justgoblin.com`. |
| **List-Unsubscribe** | **deliberately absent** | Correct for transactional auth mail: there is nothing to unsubscribe from, and a header offering it would be a false affordance. Gmail's one-click-unsubscribe requirement applies to bulk/marketing, which we do not send. |
| **Reputation** | **the real remaining risk** | Cannot be fixed in code. See §1.4. |

**Overall verdict:** authentication was **not** the cause. SPF passes and aligns,
DKIM is present and aligned, a DMARC record exists. The junk placement is best
explained by content shape (HTML-only, link-dense, unbranded subject) on top of a
**domain with no sending history** — and three of those four are now fixed.

Stated plainly because it matters: **this is an inference, not a measurement.** The
only proof of why that specific mail was junked is in its headers, in a mailbox this
session cannot read. §1.5 is how the founder gets that proof.

## 1.2 Founder action #1 — the DMARC record (copy-paste)

The current record publishes a policy nobody can observe. Replace it so aggregate
reports start arriving. Still `p=none` — this is a visibility change, not an
enforcement change, and enforcement should not be turned on before the reports show
what would be affected.

**Cloudflare → DNS → Records → edit the existing `_dmarc` TXT record:**

- **Type:** `TXT`
- **Name:** `_dmarc`
- **TTL:** Auto
- **Content:**

```
v=DMARC1; p=none; rua=mailto:dmarc@justgoblin.com; fo=1; adkim=r; aspf=r
```

Notes, so nothing here is cargo-culted:

- `rua=` — where aggregate reports go. **`dmarc@justgoblin.com` must actually
  receive mail**: `justgoblin.com` already has Cloudflare Email Routing MX records,
  so add a routing rule for that address (or point `rua` at an address that already
  works). A `rua` nobody reads is the same blindness with more DNS.
- `fo=1` — send a failure report when *any* mechanism fails, not only when both do.
- `adkim=r` / `aspf=r` — relaxed alignment, spelled out rather than left implicit.
  **Do not set `s`**: strict SPF alignment would fail, because the envelope domain
  is `send.justgoblin.com` and the From domain is the apex.
- Leave `p=none` until the reports have been read for a few weeks. `p=quarantine`
  before that is how a sender junks their own mail.

**Optional, not required** — apex SPF hardening. Only worth doing if reports show a
receiver failing the From-domain check:

```
v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all
```

(Two includes, still well inside the 10-lookup limit. It authorises nothing new for
the envelope path — it only stops a From-domain "best guess" check from softfailing.)

## 1.3 What shipped in code (commit `U1`)

| Change | File | Why |
|---|---|---|
| `text` part on every auth mail | `apps/api/src/lib/auth-email-templates.ts`, `routes/auth-email-hook.ts`, `lib/email.ts` | Ends HTML-only. Hand-written, not tag-stripped — a text part that is mangled HTML scores *worse* than none when a filter compares the parts. |
| One shared raw link | `auth-email-templates.ts` | 7 anchors → 5; 4 URLs → 3. The bilingual body no longer repeats the same address four times. |
| Brand-first subjects | `auth-email-templates.ts` | The recipient can tell **who** is asking before **what** is asked. All five subjects ≤ 60 chars. |
| "Link" instead of "Button" in the copy | `auth-email-templates.ts` | One sentence now serves both parts, and neither describes a control the reader cannot see. |
| `AUTH_REPLY_TO` | `routes/auth-email-hook.ts` | Unset by default — a Reply-To that bounces is worse than none. |
| Deliverability guards | `apps/api/src/lib/auth-email-deliverability.test.ts` | 27 tests pinning the text part, anchor counts, prose-to-link ratio, subject shape and the no-image rule, for all five mail types. |
| Both parts in the previews | `apps/api/src/scripts/render-auth-mail-previews.ts` | A preview showing only the HTML was a preview of half the message. |

Rendered artifacts: `_sprint/akt1-strang-2/mail-previews/` — `*.html` **and** `*.txt`
for all five types.

## 1.4 Code vs DNS vs time — who can fix what

- **Code could fix, and did:** multipart, link density, subject shape, wording.
  These are properties of the message, scored the same on the first send as on the
  thousandth.
- **DNS can fix:** observability (`rua`), and optionally the apex SPF softfail.
  Authentication itself already passes.
- **Neither can fix — only time and behaviour:** `justgoblin.com` is a new sending
  domain. New domains have **no reputation**, and "no reputation" routes to junk by
  default at Gmail and Outlook for exactly this kind of transactional mail. There is
  no record to publish that skips this.

**Honest timeline expectation:** reputation builds over **weeks of consistent
sending**, not hours, and it is built by *recipients*, not by senders. The two things
that actually accelerate it:

1. **Recipients marking "not spam" and replying.** Ask every tester who finds the
   mail in junk to move it to the inbox. That single action is worth more than any
   header.
2. **Steady, non-spiky volume** from the same domain to engaged recipients. A burst
   of 200 invites into cold mailboxes after weeks of silence looks exactly like the
   pattern filters are built to catch.

Anyone promising a faster fix is guessing.

## 1.5 Founder test protocol — runnable from the phone

Twenty minutes, no laptop needed. Do it **after** the DMARC record is updated and
this branch is deployed, and write the results into this file's table at the bottom.

1. **Fresh Gmail.** Create (or use) a Gmail address that has never received Goblin
   mail. Sign up at `justgoblin.com/register`. Wait 2 minutes.
2. **Record where it landed** — Inbox / Promotions / **Spam**. Note the exact folder,
   not "it arrived".
3. **Read the headers.** Gmail app → open the mail → ⋮ → **Show original**. Screenshot
   the block that shows `SPF:`, `DKIM:` and `DMARC:`. All three must read **PASS**
   with `justgoblin.com` next to them. If any says FAIL or NEUTRAL, stop and send the
   screenshot — that changes the diagnosis from reputation to authentication.
4. **Fresh Outlook/Hotmail.** Repeat 1–2 with an `@outlook.com` or `@hotmail.com`
   address. Outlook is the harshest of the three on new domains; expect the worst
   result here.
5. **A Swiss provider.** Repeat 1–2 with Bluewin, GMX or Sunrise — this is the cohort
   the first testers actually use, and it is the one no guide covers.
6. **mail-tester.com.** Open the site on the phone; it shows a one-time address like
   `test-abc123@srv1.mail-tester.com`. Sign up at Goblin with **that address**, wait
   30 seconds, then tap "Check your score". Record: **the score out of 10**, and the
   **name of every issue it lists** (not just the number — the named issues are the
   actionable part).
7. **Mark as not spam** in every mailbox where it landed in junk, and reply once to
   the Gmail one. This is not cosmetic: it is the reputation accelerator from §1.4.
8. **Repeat step 1–2 a week later** with a second fresh address per provider. The
   delta between week 1 and week 2 is the only real measurement of whether reputation
   is moving.

| Run | Date | Gmail | Outlook | Swiss (which) | mail-tester score | Named issues |
|---|---|---|---|---|---|---|
| 1 | _pending_ | | | | | |
| 2 (+7d) | _pending_ | | | | | |

---

# UNIT 2 — Landing: promise = delivery

## 2.1 The full claim sweep

Every claim on `justgoblin.com/` walked against the product. The tester's four
findings are rows 6, 12, 16 and 21 — the rest were found by this sweep.

| # | Section | Claim | Delivered today? | Action |
|---|---|---|---|---|
| 1 | Hero eyebrow | "v1.0 · Now in beta" | yes | none |
| 2 | Hero | "The agent builds, verifies, and ships it — you watch every step" | yes — `orchestrator.ts` plan → write → bounded self-heal → publish | none |
| 3 | Hero | "The AI is built in — no keys, no setup, no token counter" | yes — Swift + Forge hosted, `goblin-cap.ts` allowance, no per-token UI | none |
| 4 | Hero | "deploy in seconds" | **differently** — deploy needs a connected Vercel account first | **changed** to "go live on your own Vercel account" |
| 5 | Hero foot | "7-day free trial · No credit card required" | yes — `TRIAL_DAYS = 7`, trial starts without Stripe | none |
| 6 | Install block | "Install Goblin as an app" (read by the tester as *the model runs locally*) | **ambiguous** — installs the PWA shell, not a model | **added** the AI-location line beneath it |
| 7 | TrustedBy | "bring your own frontier": Anthropic, OpenAI, Google, Groq, xAI, Mistral, DeepSeek | yes — all seven in `config/providers.ts` | none |
| 8 | Problem 01 | "Bundled, not metered" | yes | none |
| 9 | Problem 02 | "Frontier models need 48 GB+ VRAM" | a claim about the world, not about Goblin | none |
| 10 | Problem 03 | "One-tap Send to Code" | yes — `CodeBlock.tsx:102` | none |
| 11 | Problem 04 | "Focused builder UI" | subjective positioning | none |
| 12 | HowItWorks 04 | "One click publishes. Your code, your repo, your deployment." | **differently** — the app asks for a Vercel token; this is where the tester was blindsided | **changed** to name the user's own Vercel and the one-time connect |
| 13 | SendToCode | heading/lead: "One tap. Code lands in your editor." | yes | none |
| 14 | §03 mock | hand-built chat + code panels | **no** — a drawing made beside the product, wrong after two correction passes | **deleted**; replaced with the pitch repo's iPhone mockup (§2.3) |
| 15 | §03 mock | "Draft · 2 files" pill | **no** — no such pill exists anywhere in the app | **gone with the mock**; the replacement is audited element-by-element in §2.4 |
| 16 | IslandFlow 08 | "Preview — see your live site the moment it ships" | **no — removed from the product on 2026-08-17** (PR #104, `33ad3a8`: `components/preview/` deleted, `preview-removed.test.tsx` guards it) | **deleted**; the flow is now seven steps, lead updated. Landing and product now agree — at the time of writing the removal was still in flight. |
| 17 | IslandFlow 06 | "Deploy to Vercel — Live in seconds" | **differently** — your own Vercel, connected once | **changed** |
| 18 | IslandFlow 07 | "Live notification — pushed to your phone" | yes — web push (VAPID) is wired | none |
| 19 | AgentFlow | four steps: plan / writes files / checks & self-heals / goes live | yes — verified against `orchestrator.ts` + `tools.ts` in an earlier wave, re-checked here | none |
| 20 | Proof | "Everything here works right now — start building in minutes." | yes for the flows on this page | none |
| 21 | Pricing | "≈ N Builds / month" with no definition of a build | **undefined** — the number was true, the word was not explained | **added** the definition, taken from the metering source |
| 22 | Pricing | prices $11 / $19 / $39 | yes (Tier 1; regional tiers are live and were verified in the manifesto wave) | none |
| 23 | Pricing | "N GB cloud storage" | yes — derived from `STORAGE_GB`, mirrors the server cap | none |
| 24 | Pricing | "Unlimited projects" | yes — no project-count cap in the API | none |
| 25 | Pricing | "$0 Goblin margin" on BYOK | yes | none |
| 26 | FAQ | "Settings → API Keys and paste your key" | yes — `/dashboard/settings/keys` | none |
| 27 | FAQ | "stored encrypted at rest in the EU" | **unverified from this session** — see Honest Limitations #3 | **flagged, not touched** (legal-adjacent copy is founder territory) |
| 28 | FAQ | "We never train on your data" | consistent with the privacy page | none |
| 29 | Footer | 7 links (changelog, about, manifesto, terms, acceptable-use, privacy, imprint) | all 7 routes exist | none |
| 30 | Nav | 4 in-page anchors (#why #how #pricing #faq) | all 4 targets exist | none |

**No reference to preview survives anywhere on the landing** — verified by grep over
`components/landing/`, `app/page.tsx` and `styles/landing.css`; the only remaining
match is the word "previewing" inside a source comment.

## 2.2 The "builds" question — is it a money-truth defect?

**No.** The ledger and the pricing page agree, and the definition on the page is the
one from the metering source:

- `apps/api/src/lib/goblin-cap.ts` (over `COST_UNITS_PER_BUILD`): *"A 'build' = one
  agent run / generation turn"*, reconciled 2026-06-27 to the CFO dashboard at
  0.15M cost units.
- `apps/web/lib/plan-builds.ts` mirrors that divisor and **derives** every figure, so
  the pricing numbers cannot drift from the server.
- `docs/GOBLIN_CONSUMPTION_LEDGER.md` **M4** records the subtlety that matters for
  the wording: there is **no flat per-build deduction**. A build's real spend flows
  through token accounting; the 150k divisor is a reconciliation/display constant.

So the honest shape of the claim is *a translated allowance*, not a counter ticking
down — which is why the new line says "roughly how many builds it covers" and names
complexity as the variable, rather than implying a quota. Copy that said "you get 116
builds" would have been the defect.

## 2.3 The coding section — replaced, not polished (third pass)

The first two passes patched a **hand-built** mock of the chat + code panels: pass 1
fixed an i18n leak, pass 2 fixed the product labels. The founder's verdict on the
deployed result was that it still looked nothing like the app, and that polishing was
not the fix. He is right, and the reason is structural: that mock was a drawing of the
product made *next to* the product. Each pass corrected a detail while the whole
stayed invented — which is how a "Draft · 2 files" pill nobody had ever shipped
survived two reviews.

**Founder decision: drop it and port the pitch repo's iPhone mockup.**
Source: `vinchafer/justgoblin-pitch` @ `92e6931` —
`components/mock/MockIPhonePostLogin.tsx` + `ScaledMock.tsx` +
`prodShell.module.css`. That mock was built read-only **from** `apps/web` (pitch
Sprint 11 §C.2) and is maintained against it (`scripts/sync-mockups.sh`,
`docs/MOCKUP_UPDATE_PROMPT.md`), which is exactly the property the hand-built one
lacked.

Ported to `apps/web/components/landing/sections/PhoneMock.tsx`: the fixed 390×823
replica, the ResizeObserver scaler, and the production token block — adapted to the
landing's responsive rules (fluid frame, 340 / 300 / 268px caps) and rendering the
app's **English** strings, which is accurate here because this surface really does
localize.

### 2.4 Affordance audit — every visible element, traced

Hard rule for this pass: anything that cannot be traced to real app code comes out.
Each row was checked against the code as it stands **today**, not as it stood when the
pitch mock was built.

| # | Element in the mock | Exists in app? | Kept / removed |
|---|---|---|---|
| 1 | Hamburger, 40×40, 24px 3-line icon | `layout/Header.tsx:107-124` | kept |
| 2 | Gold Goblin mark, 26px | `layout/Header.tsx:137` | kept |
| 3 | Mode tile "Chat" + chevron, r9 on `rgba(0,0,0,.18)` | `layout/Header.tsx:42, 175-193` | kept |
| 4 | Header plus, 30×30 outline circle | `layout/Header.tsx:295-315` | kept |
| 5 | Avatar "M", 30×30 | `header/AvatarMenu.tsx:105, 145-161` | kept — **corrected**: 30px on `--gold-700`/`#2a1f0f`; the pitch had 32px on `--brand-gold` |
| 6 | Eyebrow tick + "Good morning, Marie" | `dashboard/page.tsx:134, 320-322` | kept |
| 7 | H1 "Tell Goblin what you want *to build.*" | `dashboard/page.tsx:331` | kept |
| 8 | Composer placeholder (Stripe/Next.js) | `dashboard/page.tsx:342` | kept |
| 9 | Composer plus, 28px circle | `chat/ChatInput.tsx:952-966` | kept |
| 10 | Model pill "Goblin Swift" + chevron, max-w 160 | `chat/ChatInput.tsx:989-1013` | kept |
| 11 | Hint "⇧↵ new line" | `chat/ChatInput.tsx:1022` | kept |
| 12 | Mic button | `chat/ChatInput.tsx:371-378` (VoiceButton) | kept |
| 13 | Send button, 32×32 r8, idle fill | `chat/ChatInput.tsx:1046-1072` | kept |
| 14 | Four quick-prompt chips | `dashboard/page.tsx:83-86` (QUICK_PROMPTS_EN) | kept — **corrected**: all four, the pitch showed three |
| 15 | "Your projects" + "3 ACTIVE" | `dashboard/page.tsx:374-376, 119` | kept |
| 16 | Project rows: 8px dot · name · relative time | `dashboard/page.tsx:512-534` | kept |
| 17 | Dot colour | `dashboard/page.tsx:523` — takes `statusLabel().color` | kept — **corrected**: status colours, not per-project colours |
| 18 | Relative times "2 MIN AGO" / "3 DAYS AGO" / "1 MONTH AGO" | `dashboard/page.tsx:94-103` (timeAgo, en) | kept |
| 19 | "+ New project" row | `dashboard/page.tsx:536-551` | kept |
| 20 | "What's new" heading | `dashboard/page.tsx:560` | kept |
| 21 | **"Alle Updates →"** | **does not exist** — the real link is "Help & FAQ →" to `/help`, and `dashboard/page.tsx:561-564` carries the comment saying it must not promise a changelog | **removed**, replaced with the real label |
| 22 | Update rows: NEU/UPDATE tag · title · desc · date | `dashboard/page.tsx:32-70` (UPDATES, en branch) | kept, verbatim |
| 23 | `--radius-lg` on hero + panels | `design-tokens.css:133` = **20px** | kept — **corrected**: the pitch's token copy still said 14px |
| 24 | Any link, button handler or hover state | — | **removed**: the port is inert. A clickable-looking control that does nothing is a phantom affordance, and this is a picture |
| 25 | Notch, bezel, device frame | — | kept as **frame**, not product UI — it depicts the phone, not Goblin |

Four drifts (rows 5, 14, 17, 21) plus one token error (row 23) were corrected during
the port rather than carried over. Nothing in the mock is untraceable.

**The heading changed too, and that is copy the founder did not explicitly order.**
The old heading — "One tap. Code lands in your editor." — described the old picture.
The ported mock shows the phone dashboard, so keeping it would have recreated this
section's original defect: words promising one thing over a picture showing another.
It now reads "This is Goblin *on your phone*". The Send-to-Code claim is not lost —
it keeps Problem P·03, HowItWorks step 03 and IslandFlow step 03, where the words
stand alone. Revert-in-one-commit if the founder wants the old headline back.

**What the ported mock does NOT show, deliberately:** the chat code-block. That is
the one surface whose labels are hardcoded German (`CodeBlock.tsx:83,102`), and it is
no longer depicted anywhere on the landing — which is why the caption the earlier pass
needed is gone, and why the whole-page German sweep in
`tests/e2e/33-landing-i18n.spec.ts` runs again **without exclusions**.

---

## Gates

| Gate | Result | Read at |
|---|---|---|
| API vitest | **2375 / 2375** | job log, local run 2026-08-17 |
| Web vitest | **540 / 540** | local run |
| E2E `@public`, desktop + mobile (sandbox) | **168 / 170** | 2 failures, both `40-account-deletion.spec.ts › invalid token`. **Resolved at job-log level:** the same suite is green in CI, which starts a real API — PR run `32028465458` reports `198 passed, 2 flaky, 0 failed`. The two reds are a sandbox artefact (no API backend), **not** a standing known-red. |
| E2E in CI (public + auth, live API) — PR head `0f350bd` | **198 passed · 0 failed · 2 flaky** | run `32028465458`, job `95382861256`, read from the log |
| E2E in CI — **merge commit `84dbd588` on master** | **199 passed · 0 failed · 1 flaky** (200 tests) | run `32082245098`, job `95547346368`. Same tree, one fewer flaky retry. The flaky is unrelated and pre-existing: `19-mobile-create-project` on `auth-mobile`, green on retry. |
| CI on master `84dbd588` | API **2375 / 2375** (175 files) · typecheck shared+web · web build · web vitest · bundle < 400KB | runs `32082245096` / `32082245187`, jobs `95547346290` / `95547346226` / `95547346268` |
| Money-suite guard on master | **armed, green** | The guard fails loudly in CI unless all four Stripe secrets are present; `ci.yml:77-80` injects them and `ALLOW_MONEY_TEST_SKIP` appears nowhere in the workflow. The API job passed with `CI=true`, so the money suites RAN — they were not silently skipped. |
| Landing i18n suite (rewritten twice — see §2.3) | **6 / 6** | local run |
| Auth-mail suites (hook + chain + new deliverability) | **69 / 69** | local run |
| Money-suite guard, `CI=true` armed | **1 / 1** | local run |
| `assert-safe-area.mjs` | **80 / 80** | local run |
| `assert-safe-area-bottom.mjs` | **34 / 34** | local run |
| `tsc --noEmit` (api, web) | clean, clean | local run |
| `next build` | success | local run |
| Renders | **24** — 6 targets × {375, desktop} × {light, dark}, including the ported phone alone | `evidence/landing-honesty-2026-08-17/` |
| DNS re-verification | 8 lookups × 2 independent resolvers (Google DoH + Cloudflare DoH), identical answers | §1.1 |

## Honest Limitations

1. **Nothing here proves a mail reaches an inbox.** Every content fix is a change to
   properties filters are *known* to score. Not one of them was measured against a
   real Gmail/Outlook/Bluewin verdict, because sending real mail from this session
   would need live credentials. §1.5 is the measurement, and it has not been run.
2. **The cause of the original junk placement is inferred, not observed.** The
   headers of the mail that landed in the friend's junk folder were never read.
   Authentication passing today does not prove it passed then — the DMARC record
   carries no history and there are no `rua` reports to look back at. If step 3 of
   the protocol shows an authentication FAIL, this document's verdict is wrong and
   should be re-run.
3. **"Encrypted at rest in the EU" (FAQ) is unverified.** `HOSTING_CLAIMS_AUDIT.md`
   G1 records that R2 is EU-configured while Cloudflare Workers/KV are explicitly
   global. Whether the FAQ sentence — which speaks about *stored projects*, not
   published apps — is accurate could not be settled from this session. Legal-adjacent
   copy is not something to edit on a guess: reported, not touched.
4. **DKIM `d=` was not observed, only inferred.** The selector records exist and
   Resend signs with the From domain by convention. The actual `d=` value on a real
   message can only be read from a delivered mail's headers (protocol step 3).
5. **The 1024-bit DKIM key is Resend-side.** Noted, not fixed — rotating it means
   re-verifying the domain in Resend, which is a live-service action and needs the
   founder.
6. **`AUTH_REPLY_TO` is dead configuration until it is set.** It does nothing today,
   by design. If the founder does not want a monitored reply address, the honest
   move is to delete the knob rather than leave it looking like a feature.
7. **Renders are headless Chromium at DPR 2, not a real device.** The sandbox's
   browser is revision 1194 against the repo's pinned 1217; it was symlinked into the
   expected path to run at all, so these shots come from Chromium 141, not the pinned
   build. `env(safe-area-inset-*)` is zero in this environment — the screenshots prove
   layout, type and theme, not notch behaviour. **Nobody has opened the changed
   landing on a physical phone.**
8. ~~**The E2E run is 166/168, not 168/168.**~~ **CLOSED 2026-08-17 at merge.** The
   sandbox reds were an argument when this was written; CI settled it. The PR run
   (`32028465458`, job `95382861256`) starts a real API and reports **198 passed, 0
   failed**, account-deletion included. Sandbox artefact, not a known-red.
9. **The ported mock is a still, and its data is invented sample data.** Project
   names, the greeting name and the timestamps are demo content — as they are in the
   pitch. What §2.4 audits is every *affordance*: the controls, labels and chrome.
   Nobody has diffed the port against a live screenshot of the running app, because
   this session cannot log in; the audit is against the source code the app renders
   from, which is the same standard the pitch mock is maintained to.

9b. **The pitch repo was read at one commit.** `92e6931`, shallow clone. If the pitch
   has since corrected something in that mock, this port does not have it.

10. **The landing was not localized.** It remains an English page. The German copy the
   founder authored is still preserved in `de` keys that do not render.
11. **Nothing was verified in production.** Branch work; no deploy, no live check.
12. **Consumption ledger: no line needed.** No new token path, no new external
    service, no model call. Law 5 checked, not skipped.

## Carry-forward — found here, deliberately not fixed here

Both are registered in `docs/ACT2_CARRY_FORWARD.md` §L (L1, L2).

1. **`CodeBlock.tsx` has no i18n.** "Kopieren" and "An Code senden" are hardcoded
   German for every user, as is `INKLUSIVE` in `model-switcher.tsx:329`. This wave
   only stopped *depicting* that surface on the landing — the defect is hidden, not
   fixed: an English-speaking user still meets German buttons after signing in. App
   code, owned by the parallel session.

2. **The pitch mock is now stale.** The five drifts corrected during the port
   (§2.4 rows 5, 14, 17, 21, 23) were fixed in Goblin's copy only;
   `vinchafer/justgoblin-pitch` still carries all of them, and its §04 still shows
   them. Note the direction has reversed: Goblin now holds the corrected version, so
   a future `sync-mockups.sh` pass must not overwrite it from the pitch.

## Founder actions

1. **Update the `_dmarc` TXT record** to the block in §1.2, and make sure the `rua`
   address actually receives mail (Cloudflare Email Routing rule). Highest value of
   anything in this document: it is the only change that turns guessing about
   deliverability into reading about it.
2. **Run the mail test protocol (§1.5)** after this branch is deployed — 20 minutes
   from the phone. Write the results into the table. If step 3 shows an
   authentication FAIL, reopen this wave.
3. **Review the new §03 section on a real device**, light and dark. It is the ported
   iPhone mockup, and its heading changed with it ("This is Goblin on your phone") —
   see §2.3 for why the old headline could not stay over the new picture, and §2.4 for
   the element-by-element audit.
4. **Decide on `AUTH_REPLY_TO`**: point it at a mailbox that is read, or say so and
   the knob comes out.
5. **Settle the FAQ's "encrypted at rest in the EU"** (Honest Limitation #3) — the
   only landing claim this sweep could not verify.
