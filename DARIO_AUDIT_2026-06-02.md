# Dario Audit — 2026-06-02

*Persona: Dario Amodei. Investor/CEO mindset. Five minutes, clicking around, deciding "real product" vs "tech demo with good taste."*

## Overall impression (3 paragraphs)

The first 30 seconds are genuinely strong. The landing page ("Tell it what you want. *It ships.*") is confident, the typography is expensive-looking, the value line is concrete — "Bring your own AI keys. Push to GitHub. Deploy to Vercel." — and "NOW IN BETA · no credit card" lowers the bar to try. The new g-mark is consistent from the marketing site through the app. This does not look like a weekend hack; someone with taste owns this surface. I'd keep clicking.

Then I sign in and the seams show. The product is **bilingual by accident** — the marketing site is English ("Start building"), the moment I'm authenticated everything flips to German ("Sag Goblin, was du bauen willst", "Veröffentlichen"). For a global investor that reads as "this was built for one founder, not yet productized." The dashboard sidebar is full of **58 `[E2E-TEST]` projects** — internal test garbage shipped to the live account I'm looking at. And a small red **"1 Issue"** chip sits in the corner. Individually minor; together they whisper "pre-product."

The thing that would actually stop my check from clearing: **the core loop doesn't run.** I open a project, go to the Code Tab (which is well-built — parallel sessions, light/dark, a real two-step Save→Publish), type "build me X," and get **"Model not found in LiteLLM."** The headline promise — *tell it what you want, it ships* — fails on the first try for a fresh trial user. Everything around the promise (deploy URLs that persist, a real file explorer, undo/redo, a daily dashboard) is polished and real. But the engine in the middle is stalled. Right now this is a beautifully finished car that doesn't start.

## Findings

**CRITICAL — the AI loop is dead for a trial user.** Prompt → "Model not found in LiteLLM" / thread shows "Fehler." *What I'd say:* "Your entire pitch is the first prompt. If a new user's first prompt errors, nothing else matters. Fix model provisioning for trials — ship a default model or force BYOK setup in onboarding before they can reach an empty prompt box." *Do:* gate the chat/code prompt until a working model is guaranteed; never let a user reach a prompt they can't run.

**SERIOUS — bilingual identity.** English marketing, German app. *Say:* "Pick one, or detect locale. The switch makes it feel like an internal tool with a marketing skin." *Do:* i18n or commit to one language end-to-end for beta.

**SERIOUS — test-data pollution in a live account.** 58 `[E2E-TEST]` projects in the sidebar. *Say:* "Never let me see your test fixtures." *Do:* scope E2E data to throwaway accounts; clean the demo/trial account.

**COSMETIC→SERIOUS — the KEYBOARD SHORTCUTS panel.** It floats over the lower-right of the Code Tab and the project hub and doesn't stay dismissed across navigation, covering real content (the URLs card, the editor). *Say:* "A help overlay shouldn't sit on top of my work." *Do:* dismiss-and-remember, or move to a `?` affordance only.

**COSMETIC — the "1 Issue" dev chip.** Dev-only (hydration warning under Next 16), but visible in the environment I'm shown. *Do:* ensure it's absent in the build I demo.

**POSITIVE — the supporting cast is investable.** Persistent live URL with copy, a genuine Finder-style file explorer (upload non-code assets, preview, delete), undo/redo like Word, and a project hub that's becoming a real daily surface (recent chats/sessions/deploys/URLs). The Save→Publish "Zwischenraum" is a tasteful product decision. Mobile holds up (no clumsy bottom tab bar, clean single-column stacks).

## Verdict

**Would I invest today?** Not on a five-minute click-through where the first prompt errors. **Would I take a second meeting?** Yes — the craft is real and the surrounding product is more complete than most pre-seed demos. The gap is narrow and unglamorous: provision a model so the promise fires, unify the language, scrub the demo account. Fix those three and the "is this real?" question flips to yes. **Would I tell friends?** Only once "tell it what you want" actually ships something on the first try.
