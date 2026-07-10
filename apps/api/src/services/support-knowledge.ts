// WAVE-J (J2): the support agent's knowledge base is now the SINGLE-SOURCE help
// corpus in @goblin/shared (help-content.ts) — the same articles users read, so
// the agent's facts can never drift from the docs.
//
// The previous hand-maintained KB here asserted product-contradicting claims
// ("$9/month, one plan", "Goblin-hosted models (coming)") and a "Discord" channel
// that no longer exists. It has been REPLACED by the verified corpus. This thin
// wrapper is kept only so any lingering importer keeps compiling.

import { renderHelpForAgent } from '@goblin/shared/src/help-content';

export function getKnowledgeBase(lang: 'de' | 'en' = 'de'): string {
  return renderHelpForAgent(lang);
}
