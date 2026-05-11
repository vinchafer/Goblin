# Goblin — Architecture Decisions
**Phase A output | 2026-05-11 | Binding until Phase 3 complete**

---

## 1. Local/Cloud Switch Architecture

### Decision: Web UI shows toggle, LOCAL is gated to Desktop App

**ARCH v6 §8 is binding:** Browser cannot reach localhost:11434 (CORS + security model). Local mode = Tauri desktop only.

**Web behavior (Phase B implementation):**
- Toggle exists in topbar (visual consistency with desktop)
- LOCAL state: disabled, tooltip: "Local mode requires the Goblin Desktop App. Download →"
- CLOUD state: active, default in browser
- No routing changes in web API client — always cloud

**Tauri behavior (Phase 3):**
- LOCAL: routes API calls to localhost:11434 (Ollama), bypasses Railway entirely
- CLOUD: routes to Railway as normal
- `window.__TAURI__` present → toggle is functional
- `window.__TAURI__` absent → LOCAL disabled with tooltip

**API Client implementation (`lib/api-client.ts`):**
```typescript
function getBaseUrl(): string {
  const mode = localStorage.getItem('goblin_routing_mode') ?? 'cloud'
  if (mode === 'local' && window.__TAURI__) {
    return 'http://localhost:11434'  // Ollama
  }
  return process.env.NEXT_PUBLIC_API_URL!
}
```

**Why not PWA local mode?** Browser security model. `localhost` fetch from a cloud-served PWA is blocked unless the PWA is served from localhost too. Tauri runs natively — no cross-origin restriction.

---

## 2. Hardware Detection: Browser API + Optional Tauri Extension

### Decision: Browser-first, Tauri extends

**Phase B (web):**
- `navigator.deviceMemory` → RAM estimate (powers of 2, max 8GB reported)
- `navigator.hardwareConcurrency` → logical CPU cores
- WebGL renderer string → GPU name (not VRAM)
- Limitation: `deviceMemory` caps at 8 — can't distinguish 16GB from 32GB

**Phase 3 (Tauri):**
- `sys-info` Tauri plugin → real RAM, GPU VRAM via native OS API
- Returns actual values: 32768MB RAM, 24576MB VRAM
- Unlocks precise model recommendations

**Model recommendation table (Phase B — browser-estimable):**
```
RAM <8GB (or deviceMemory=4):  Qwen 2.5 Coder 1.5B, DeepSeek Coder 1.3B
RAM 8GB  (deviceMemory=8):     + Qwen 2.5 Coder 7B, Llama 3.1 8B
RAM 16GB+ (Tauri only):        + Qwen 2.5 Coder 14B, Mistral 7B
RAM 24GB VRAM (Tauri only):    + Qwen 2.5 Coder 32B
```

Browser path shows max 2 tiers (4GB and 8GB) since `deviceMemory` caps. Tauri shows all 4 tiers with real data. This is acceptable — the web hardware check is "directionally correct, not precise."

---

## 3. Auto-Fallback Chain Architecture

### Decision: Provider-chain stored in `model_preferences` JSONB per project

**Data structure:**
```json
{
  "fallback_chain": [
    { "provider": "anthropic", "model": "claude-sonnet-4-6", "tier": "byok" },
    { "provider": "groq", "model": "llama-3.3-70b", "tier": "free_api" },
    { "provider": "goblin", "model": "qwen-2.5-coder-32b", "tier": "goblin_hosted" },
    { "action": "block" }
  ],
  "trigger_conditions": {
    "on_rate_limit": true,
    "on_queue_latency_ms": 20000,
    "credit_threshold_usd": 5.0
  }
}
```

**Trigger logic in `model-router.ts`:**
1. Try step[0] — if HTTP 429 → step[1]
2. If step[0] queue latency > threshold → step[1]
3. If `action: block` reached → 402 response with upgrade CTA
4. Each successful fallback: log source_tier to `chat_messages.source_tier`

**UI visibility:**
- Badge under each AI message: "via Anthropic Claude" or "via Groq (Fallback)"
- Toast on fallback: "Switched to Groq — Anthropic at limit. [Settings →]"
- Badge is subtle (small, gray) — not alarming

**Global vs project fallback chain:**
- Project-level in `model_preferences.fallback_chain`
- Global default in user settings (new endpoint: `PATCH /api/users/routing`)
- Project inherits global if no project-level chain set

**Why JSONB not separate table?** Phase 1-2: simple enough. Phase 3: if chains get complex (>5 steps, conditional logic), migrate to separate table. Don't over-engineer now.

---

## 4. Onboarding: State-Machine Wizard, not LLM-driven

### Decision: Guided wizard (deterministic), LLM-enhanced tooltips only

**Why not LLM-driven onboarding agent (Phase 1-2):**
- LLM adds latency (1-3s per step), unpredictable output
- Can't guarantee OAuth flows get triggered correctly from unstructured conversation
- Requires function-calling infrastructure not yet built
- Risk: user in mid-OAuth callback, LLM generates confusing follow-up
- Phase 2 goal: Autonomous Agent handles this — 5-step wizard is the bridge

**Wizard is state-machine with 5 explicit steps:**
```
STEP_WELCOME → STEP_AI_PROVIDER → STEP_CODE_HOSTING → STEP_DEPLOY_TARGET → STEP_DONE
```

**State persistence (recovery logic):**
- `onboarding_steps` table: `user_id, step, status (pending/skipped/completed), data JSONB`
- On login check: if incomplete onboarding → `/onboarding?resume=true`
- "Pick up where you left off?" banner (not modal — less disruptive)

**LLM enhancement (optional, Phase 2):**
- Tooltip in AI Provider step: "Which provider is best for me?" → small chat widget
- Does NOT control navigation — only answers questions

---

## 5. Trial Gate Middleware

### Decision: Server-side check on every cloud API request

**Middleware chain:**
```
Request → auth.ts → trial-gate.ts → usage-limit.ts → handler
```

**Trial gate logic:**
```typescript
// Skip if: BYOK request, Local mode, Admin
// Check: cloud_trial_ends_at < now() → 402 response
// Response body: { error: "trial_expired", upgradeUrl: "/dashboard/upgrade" }
```

**Frontend handling:**
- `api-client.ts` catches 402 → redirects to `/dashboard/upgrade`
- Not silent failure — always clear "what happened and what to do"

**BYOK exception:** BYOK requests never hit trial gate. Trial only limits Goblin Hosted + Free API pool usage. This is deliberate: if user brings own key, they should always be able to use it.

---

## 6. i18n Strategy: Minimal Wrapper, No i18next

### Decision: Simple key-value map, EN primary, DE secondary

**Why not i18next:** Heavy library, SSR complications with App Router, overkill for 2 languages.

**Implementation:**
```typescript
// lib/i18n/strings.ts
export const strings = {
  en: {
    'error.network': "Couldn't reach our servers. Check your connection — your work is safe.",
    'chat.thinking': "Goblin is thinking...",
    // ...
  },
  de: {
    'error.network': "Server nicht erreichbar. Verbindung prüfen — deine Arbeit ist sicher.",
    'chat.thinking': "Goblin denkt nach...",
    // ...
  }
}
```

**Language detection:** `navigator.language.startsWith('de')` → DE, otherwise EN. No cookie, no DB column. Fast, simple.

**Scope:** Only new strings written in Phase D+. Not retroactive migration of existing strings (too expensive for 24h sprint).

---

*All decisions above are binding for Phase 1-2 implementation. Phase 3 revisits: Local Mode (Tauri), LLM-driven agent onboarding, multi-language expansion.*
