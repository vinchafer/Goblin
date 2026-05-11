# Setup Buddy — Test Conversations

## Test 1: Developer building a SaaS app

**User:** I'm building a SaaS dashboard for my newsletter. It'll have analytics, subscriber management, and a payment integration.

**Expected agent behavior:**
- Identifies: web app, developer-leaning, needs reliability
- Recommends: Anthropic Claude (best for code), GitHub (standard for devs), Vercel (SaaS standard)
- Should NOT ask follow-up questions — this is enough info

**Expected structured output:**
```json
{"type":"recommendation","category":"ai_provider","recommended":{"id":"anthropic","label":"Anthropic Claude","reason":"Best for code generation — precise, follows instructions well, widely used in developer tools.",...}}
```

**Pass criteria:** Single recommendation per dimension, clear reasoning, deeplinks correct.

---

## Test 2: Non-technical user, no idea

**User:** I don't really know, I just want to build something cool

**Expected agent behavior:**
- Asks ONE clarifying question: "What kind of 'cool'? Do you mean a website, an app, a tool for work...?"
- After user clarifies: picks safest defaults (Anthropic + GitHub + Vercel or skip deploy)
- Does NOT ask more than 2 questions total

---

## Test 3: User with no API key

**User:** I want to build a landing page for my freelance business. I don't have any API keys.

**Expected agent behavior:**
- Recommends: Free pool ("no setup needed, start right away")
- Code hosting: Goblin Cloud only (simpler for non-devs)
- Deploy: Vercel or skip
- Should explicitly mention free pool doesn't require setup

---

## Test 4: PII test — user pastes API key

**User:** My Anthropic key is sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

**Expected agent behavior:**
- Immediate PII warning response
- Does NOT echo the key back
- Redirects to Settings → API Keys
- Response: "[I've hidden that for your security — API keys go in Settings → API Keys, not in chat]"

---

## Test 5: German-speaking user

**User:** Ich möchte eine App für mein kleines Restaurant bauen. Speisekarte, Reservierungen, das Übliche.

**Expected agent behavior:**
- Replies in German
- Recommends appropriate stack
- JSON blocks stay in English (for UI parsing)

---

## Test 6: Resume from partial state

**Existing state:** `{ai_provider_choice: "anthropic"}`

**User:** returns to chat

**Expected agent behavior:**
- "Welcome back! Last time we set up: ✓ AI Provider: anthropic. Want to continue?"
- Skips AI provider question, goes straight to code hosting

---

## Test 7: Off-topic question

**User:** Can you write me a React component for a button?

**Expected agent behavior:**
- Brings back on-topic: "Let's get you set up first — then you can ask me anything. What are you building?"
- Does NOT write the component
- Does NOT do this more than once — second off-topic attempt gets the same response, not escalating

---

## Test 8: "I have no idea, just pick something"

**User:** Just pick whatever you think is best, I don't care

**Expected agent behavior:**
- High confidence: "Alright — here's what I'd pick for most projects:"
- Recommends Anthropic + GitHub + Vercel
- No hedging, no "it depends"
- All 3 recommendations in one response

---

## Evaluation Notes

- All tests documented above represent the expected behavior with a well-configured LLM (Anthropic Claude)
- Rule-based fallback (when no AI model available) handles tests 2, 3, 7, 8 with simplified logic
- PII detection (Test 4) runs BEFORE any AI call — purely code-based, not LLM-dependent
- German support (Test 5) requires LLM — rule-based fallback responds in English
