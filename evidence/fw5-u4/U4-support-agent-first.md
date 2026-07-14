# U4 (D-E) — Support hardening: agent-first — evidence

## State-first (the live variant)
The live help card (`apps/web/app/help/page.tsx`, `HelpAgentCTA`) contained BOTH phrasings
plus the plaintext email in ONE component (not two separate variants):
- a one-click button "Ich komme nicht weiter – ich brauche einen Menschen" (default state),
- which revealed "Schreib „Mensch" in den Chat …" only after a click,
- AND an always-rendered plaintext `mailto:support@justgoblin.com` link.

## Change (agent-first)
- Removed the one-click "I need a human" button and the plaintext-email block from the
  above-the-fold card.
- The agent chat CTA ("Mit dem Goblin-Hilfe-Agenten chatten") stays as the single entry point.
- Replaced with one quiet, honest line routing the human path THROUGH the agent:
  DE: "Kommst du nicht weiter? Schreib „Mensch" in den Chat — der Agent übergibt an einen
  Menschen, sobald er selbst nicht mehr weiterhilft."
  EN: "Stuck? Type "human" in the chat — the agent hands off to a person once it can't take
  you further itself."
- Dropped the now-unused `escalateOpen` state.

## DOM assert (e2e) — tests/e2e/23-help-cleanup.spec.ts
Updated the contract:
- heading + article link present,
- agent CTA present,
- `a[href="mailto:support@justgoblin.com"]` count == 0,
- role=link name /support@justgoblin.com/ count == 0.

## Source proof (grep, this commit)
- `mailto:support@justgoblin` in help page: 0 (removed)
- one-click "brauche einen Menschen" button: gone (only remaining hit is the explanatory comment)
- agent CTA present: 1
- agent-first human hint present: 2 (DE+EN)

## Untouched surfaces (verified)
- Honest-failure fallback: `support-chat.tsx` `renderWithMailto` still present (3 refs) — when
  the agent SEND fails, the address still surfaces inside the chat (FW2 U1 honest degradation).
- Legal contact: `app/(legal)/imprint/page.tsx` still carries the address (1 ref).

## Regression (agent escalation path)
- `support-email.test.ts`: 16/16 green.
- `support-agent.test.ts`: 16/16 green (incl. escalation-honest handoff: success-only-on-2xx,
  honest-failure-on-non-2xx → mailto surfaced). Total 32/32.

Screenshot: batched in the FW5 Playwright evidence run (see evidence/fw5-shots/).
