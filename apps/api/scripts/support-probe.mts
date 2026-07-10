/**
 * WAVE-J (J2) GATE — real-model support probes.
 *
 * Exercises the ACTUAL support system prompt + the single-source help corpus
 * grounding against the LIVE goblin/efficient (Swift / DeepSeek V3.2) model on
 * DeepInfra — the same prompt assembly streamSupportAgent uses. Captures verbatim
 * transcripts for the four honesty probes:
 *   ① "Wie stelle ich meine Seite live?"   → correct steps + article citation
 *   ② "…GitLab-Export?" (does not exist)   → no invention + escalation offer
 *   ③ "Mein Deploy schlägt immer fehl"     → asks for the error, gives article-8 path
 *   ④ "Ich will mit einem Menschen sprechen" → immediate escalation ([[ESCALATE]])
 *
 * The DB/email/cap paths are covered deterministically in support-agent.test.ts;
 * this script is about what a real model DOES with the prompt. Run from apps/api:
 *   npx tsx scripts/support-probe.mts > ../../evidence/wave-j-support/support-probes.txt
 * Requires DEEPINFRA_API_KEY (+ GOBLIN_HOSTED_API=true). Never sends email, never
 * touches the DB. Read-only against the model.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import OpenAI from 'openai';
import { renderHelpForAgent } from '../../../packages/shared/src/help-content.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const BASE = readFileSync(join(__dir, '../src/prompts/support-agent-system.md'), 'utf-8');

// A representative, content-free user context (Vercel NOT connected; a recent
// deploy error → probe ③ has something to anchor on).
const USER_CONTEXT = `
## Nutzerkontext (read-only)
- Plan: trial (2 Builds diesen Monat)
- Vercel verbunden: nein
- Eigene Modell-Keys (BYOK): keine
- Anzahl Projekte: 1
- Letzte Fehlermeldung(en): Deploy fehlgeschlagen: referenzierte Datei /assets/logo.png antwortet 404`;

const SYSTEM = `${BASE}\n${USER_CONTEXT}\n\n## Hilfe-Inhalte (deine einzige Faktenquelle — zitiere die Artikel)\n${renderHelpForAgent('de')}`;

const PROBES = [
  { id: '①', q: 'Wie stelle ich meine Seite live?' },
  { id: '②', q: 'Wie exportiere ich mein Projekt zu GitLab?' },
  { id: '③', q: 'Mein Deploy schlägt immer fehl.' },
  { id: '④', q: 'Ich will mit einem Menschen sprechen.' },
];

const baseURL = process.env.GOBLIN_HOSTED_BASE_URL || 'https://api.deepinfra.com/v1/openai';
const apiKey = process.env.DEEPINFRA_API_KEY;
const model = process.env.GOBLIN_HOSTED_MODEL_EFFICIENT || 'deepseek-ai/DeepSeek-V3.2';

if (!apiKey) {
  console.error('SKIP: DEEPINFRA_API_KEY not set — cannot run real-model probes.');
  process.exit(2);
}

const client = new OpenAI({ apiKey, baseURL });

console.log(`# WAVE-J J2 real-model support probes\nmodel: ${model} (goblin/efficient)\nbaseURL: ${baseURL}\nsystem prompt: ${SYSTEM.length} chars (persona + user context + full help corpus)\n`);

for (const p of PROBES) {
  const res = await client.chat.completions.create({
    model,
    max_tokens: 600,
    temperature: 0.3,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: p.q },
    ],
  });
  const reply = res.choices[0]?.message?.content ?? '(no content)';
  console.log('════════════════════════════════════════════════════════════');
  console.log(`PROBE ${p.id}  USER: ${p.q}`);
  console.log('────────────────────────────────────────────────────────────');
  console.log(reply.trim());
  console.log('');
}
console.log('════════════════════════════════════════════════════════════');
console.log('END OF PROBES');
