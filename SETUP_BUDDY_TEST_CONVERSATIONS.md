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

---

## Test 9: "Ich kenn mich nicht aus" (complete beginner)

**User:** Ich habe noch nie programmiert und weiß nicht mal was eine API ist

**Expected agent behavior:**
- Replies in German
- Explains clearly without jargon: "API keys are like passwords for AI services"
- Recommends Free pool (no setup needed) + Goblin Cloud + Skip deploy
- Does NOT assume technical knowledge
- One sentence max on each concept

**Pass criteria:** No unexplained technical term, Free pool recommended, German throughout

---

## Test 10: "Ich will nur Free nutzen"

**User:** Ich will nichts bezahlen, gibt es eine kostenlose Option?

**Expected agent behavior:**
- Honest about the trial: "3 days free, then $9/month"
- Mentions Local Mode (free forever) if appropriate
- Does NOT promise free features that don't exist
- Does NOT hide the pricing

**Pass criteria:** Accurate pricing, mentions trial, mentions Local Mode option

---

## Test 11: "Was ist BYOK?"

**User:** What does BYOK mean? I keep seeing it everywhere

**Expected agent behavior:**
- Explains BYOK in plain English: "You bring your own API key from Anthropic, OpenAI, etc."
- Explains the benefit: "You pay the provider directly, Goblin adds no markup. Your key, your bill."
- Asks if they have a key already

**Pass criteria:** Accurate explanation, no jargon, moves toward recommending a provider

---

## Test 12: "Ich hab schon GitHub, was muss ich einrichten?"

**User:** I already have a GitHub account set up, what do I still need to configure?

**Expected agent behavior:**
- Skips GitHub recommendation (already done)
- Focuses on: AI provider key + deploy target
- Does NOT re-recommend GitHub

**Pass criteria:** Respects existing setup, doesn't re-ask for GitHub

---

## Test 13: Language switch mid-conversation

**Turn 1 (English):** I want to build a recipe app
**Turn 2 (German, same user):** Ich meine für iOS oder Web, ich bin noch nicht sicher

**Expected agent behavior:**
- Switches to German in Turn 2 reply without comment
- Continues in German for the rest of the conversation
- Asks one clarifying question (iOS vs Web matters for recommendation)

**Pass criteria:** Seamless language switch, no comment on the switch, asks clarifying question

---

## Evaluation Notes

- All tests documented above represent the expected behavior with a well-configured LLM (Anthropic Claude)
- Rule-based fallback (when no AI model available) handles tests 2, 3, 7, 8 with simplified logic
- PII detection (Test 4) runs BEFORE any AI call — purely code-based, not LLM-dependent
- German support (Tests 5, 9, 13) requires LLM — rule-based fallback responds in English
- Tests 9–13 added in Session 3 (Phase N3)
