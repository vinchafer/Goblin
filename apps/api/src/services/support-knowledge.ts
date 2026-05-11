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

**What is BYOK?**
BYOK = Bring Your Own Key. Users connect their own API keys from providers like Anthropic, OpenAI, Google, Groq, etc. Goblin routes requests through those keys. Users pay the provider directly — Goblin adds no markup. Keys are encrypted with AES-256 at rest.

**Supported AI providers:**
Anthropic, OpenAI, Google AI Studio, Groq, Mistral, xAI/Grok, DeepSeek, Together.ai, Fireworks, OpenRouter, and any OpenAI-compatible endpoint.

**Local mode:**
Local mode requires the Goblin Desktop App (Tauri). It connects to a local Ollama instance — free, no cloud needed. Cloud mode uses Goblin's infrastructure.

---

## Pricing

**Current plan:** $9/month (one plan, everything included)
**Trial:** 3 days free, no credit card required to sign up
**What's included:** Unlimited projects, BYOK (all providers), GitHub push, 5GB storage, Send to Code, web push notifications, mobile access

**BYOK and billing:** BYOK requests don't count against the monthly limit. Only Goblin-hosted and Free-API-pool requests count.

**Cancel:** Cancel anytime in Settings → Billing → Stripe Portal. Your projects remain accessible.

**Refunds:** Contact the team on Discord for billing questions.

---

## Common Issues

**"No model connected" error:**
You need to add an API key. Go to Settings → API Keys and add your Anthropic, OpenAI, or other provider key.

**"Rate limit" error:**
Your AI provider is rate-limiting requests. Either wait a few minutes or set up Auto-Fallback in Settings → Routing to automatically switch to another provider.

**Build fails / "failed to generate":**
Check that your API key is valid and has credits. In Settings → API Keys you can see which providers are connected and their status.

**GitHub push fails:**
Go to Settings → Integrations and reconnect GitHub. Make sure you've given Goblin permission to write to repositories.

**Preview tab is disabled:**
The Preview tab activates after a successful Vercel deploy. Deploy first using the Deploy button in the Code tab.

**Can't log in:**
Use Magic Link (email). If you're on the wrong device, check your email for the link. Links expire in 15 minutes.

---

## Settings Pages (deeplinks)

- API Keys: /dashboard/settings/keys
- Integrations (GitHub, Vercel): /dashboard/settings/integrations
- Billing: /dashboard/settings/billing
- Routing/Fallback chain: /dashboard/settings/routing
- Local mode settings: /dashboard/settings/local
- Usage dashboard: /dashboard/usage
- Upgrade: /dashboard/upgrade

---

## Data & Privacy

**Where is code stored?**
Hetzner Object Storage, Frankfurt, Germany. GDPR compliant. Encrypted at rest.

**Does Goblin train on my code?**
No. Never. Your code is only used to fulfill your requests.

**Data deletion:**
Contact the team on Discord. Account deletion removes all projects and data.
`;

export function getKnowledgeBase(): string {
  return KNOWLEDGE_BASE;
}
