// Static knowledge base — loaded at startup, no vector DB needed for MVP.
// Future: replace with RAG + embeddings.

export const KNOWLEDGE_BASE = `
## Goblin Features

**What is Goblin?**
Goblin is a cloud-based AI coding studio. Users describe what they want to build, Goblin generates the code. Works on any device, including mobile.

**Key features:**
- Chat with AI to generate and edit code
- [Send to Code] button — one tap sends AI output to the code editor
- Code editor with file tree and syntax highlighting
- Preview tab for live iframe preview
- GitHub push integration
- Vercel deploy integration
- BYOK (Bring Your Own Key) — connect your own AI provider API keys
- Web push notifications for build completion
- PWA — installable on mobile as an app
- Auto-Fallback — automatically switches provider when one is rate-limited

**What is BYOK?**
BYOK = Bring Your Own Key. Users connect their own API keys from providers like Anthropic, OpenAI, Google, Groq, etc. Goblin routes requests through those keys. Users pay the provider directly — Goblin adds no markup. Keys are encrypted with AES-256 at rest.

**Supported AI providers:**
Anthropic, OpenAI, Google AI Studio, Groq, Mistral, xAI/Grok, DeepSeek, Together.ai, Fireworks, OpenRouter, and any OpenAI-compatible endpoint.

**Local mode:**
Local mode requires the Goblin Desktop App (Tauri). It connects to a local Ollama instance — free, no cloud needed. Cloud mode uses Goblin's infrastructure. Local mode has no trial limitations, no usage limits. Data stays on the user's machine.

**What is NOT in Goblin (don't claim otherwise):**
- Team collaboration (coming in Phase 4)
- GPU inference / Goblin-hosted models (coming)
- Template marketplace (coming)
- React Native / mobile app export (coming)

---

## Pricing

**Current plan:** $9/month (one plan, everything included)
**Trial:** 3 days free, no credit card required to sign up
**What's included:** Unlimited projects, BYOK (all providers), GitHub push, 5GB storage, Send to Code, web push notifications, mobile access, Auto-Fallback
**After trial:** Access is gated — you see an upgrade prompt. Data is safe, not deleted.

**BYOK and billing:** BYOK requests don't count against the monthly limit. Only Goblin-hosted and Free-API-pool requests count.

**Cancel:** Cancel anytime in Settings → Billing → Stripe Portal. Your projects remain accessible.

**Refunds:** Contact support — human review required.

---

## Trial System FAQ

**How does the trial work?**
When you sign up, you get 3 days of free cloud access. No credit card needed. After 3 days, cloud features are gated until you upgrade to $9/month.

**What happens when my trial expires?**
You'll see a "Trial Ended" banner and can't use AI features in cloud mode until you upgrade. Your projects and code are still there — nothing is deleted.

**I just signed up and already see a trial banner — is that right?**
Yes. The trial counter starts at signup, not at first use.

**Can I extend my trial?**
Currently no. Contact support and explain your situation — we'll handle it case by case.

**Does the trial apply to local mode?**
No. Local mode (Goblin Desktop App with Ollama) has no trial and no usage limits. It's always free.

**Trial ended but I'm still being billed?**
Trial is free — you should not be billed. If you see a charge, contact support immediately.

**Can I use BYOK during the trial?**
Yes. BYOK works during the trial. Adding a BYOK key during trial doesn't extend the trial.

---

## Local Mode FAQ (Goblin Desktop App)

**What is Local Mode?**
Local Mode uses the Goblin Desktop App (built with Tauri) instead of the web browser. It connects to Ollama running on your machine — all AI runs locally, no cloud needed.

**How do I install the Desktop App?**
Download from the Goblin website. Requires macOS (Windows/Linux coming). Also requires Ollama installed separately (free from ollama.com).

**What Ollama models work?**
Any Ollama-compatible model. Recommended: llama3, codellama, mistral. The Desktop App shows your installed models and lets you pull new ones.

**Does Local Mode need an internet connection?**
Only for GitHub push and Vercel deploy. AI generation works fully offline.

**Is Local Mode free?**
Yes, always. No trial, no subscription, no usage limits.

**How do I switch between Cloud and Local Mode?**
In the app, there's a toggle in the top bar (Cloud / Local). On desktop app this toggle activates Local Mode. On the web, only Cloud Mode is available.

---

## Common Issues & Error Codes

**"No model connected" / "No model available":**
Add an API key in Settings → API Keys. Or activate Local Mode if you have Ollama running.

**"Rate limit" / "429" error:**
Your AI provider is throttling requests. Options: (1) wait 60 seconds, (2) set up Auto-Fallback in Settings → Routing to automatically switch providers.

**"Build failed" / "failed to generate":**
Check that your API key is valid and has credits. Go to Settings → API Keys to verify status. Also check that the model you selected is available on your plan.

**"GitHub push failed" / "403 on push":**
Reconnect GitHub in Settings → Integrations. Make sure Goblin has write permission to the target repo.

**"Preview tab is disabled":**
The Preview tab activates after a successful Vercel deploy. Click Deploy in the Code tab first.

**"Can't log in" / "Magic link not working":**
Magic links expire in 15 minutes. Request a new one. Check spam folder. If on a different device, open the link on the device where you requested it (some email clients redirect; copy-paste the URL instead).

**"Trial has ended" banner:**
Your 3-day trial ended. Upgrade to $9/month in Settings → Billing, or use Local Mode (free, no trial).

**"Usage limit reached":**
You've hit your monthly request limit for Goblin-hosted / Free-pool requests. Options: (1) upgrade plan, (2) add your own API key (BYOK — doesn't count against limit).

**"API key invalid" / "401 from provider":**
The key is wrong or revoked. Delete it in Settings → API Keys and add a fresh one from your provider's dashboard.

**"Storage limit" / "Upload failed":**
Your account is at the 5GB storage limit. Delete old project files or contact support to review.

---

## Settings Pages (deeplinks)

- API Keys: /dashboard/settings/keys
- Integrations (GitHub, Vercel): /dashboard/settings/integrations
- Billing: /dashboard/settings/billing
- Routing/Fallback chain: /dashboard/settings/routing
- Local mode settings: /dashboard/settings/local
- Usage dashboard: /dashboard/usage
- Upgrade: /dashboard/upgrade
- Profile / account: /dashboard/settings/profile

---

## Data & Privacy

**Where is my code stored?**
Your projects and files are stored encrypted at rest in the EU (Backblaze B2, eu-central-003).

**Where does AI processing happen?**
When you use the Goblin-bundled models (no key required), your prompt and code context are sent to our inference provider in the United States for processing. We use only open-source models configured for zero data retention, and rely on EU Standard Contractual Clauses (SCCs) for the transfer. When you bring your own API key (BYOK), prompts go directly to the provider you chose, under your own account and their terms. Storage stays in the EU either way; only the inference step may run outside the EU.

**Does Goblin train on my code?**
No. Never. Your code is only used to fulfill your requests, and the bundled models are configured for zero retention.

**Data deletion:**
Contact support. Account deletion removes all projects and data within 30 days.
`;

export function getKnowledgeBase(): string {
  return KNOWLEDGE_BASE;
}
