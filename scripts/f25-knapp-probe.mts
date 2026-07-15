/**
 * F-25 real-model probe — does the "knapp" preference produce genuinely short answers?
 *
 * Builds the REAL system prompt (buildGoblinChatSystemPrompt with responseStyle='knapp')
 * and sends 3 distinct user turns to the live Swift model (DeepSeek-V3.2 on DeepInfra,
 * the goblin/efficient tier). Passes when 3/3 responses are short — ≤3 sentences AND no
 * promotional/upsell closer. Numeric rate printed; verbatim replies dumped for the
 * evidence file. No secrets printed.
 *
 * Run: DEEPINFRA_API_KEY=… npx tsx scripts/f25-knapp-probe.mts
 */
import { buildGoblinChatSystemPrompt } from '../apps/api/src/prompts/goblin-chat-system';

const BASE = process.env.GOBLIN_HOSTED_BASE_URL || 'https://api.deepinfra.com/v1/openai';
const MODEL = process.env.GOBLIN_HOSTED_MODEL_EFFICIENT || 'deepseek-ai/DeepSeek-V3.2';
const KEY = process.env.DEEPINFRA_API_KEY;

if (!KEY) {
  console.error('DEEPINFRA_API_KEY not set — cannot run real-model probe. HALT.');
  process.exit(2);
}

const system = buildGoblinChatSystemPrompt({
  userPreferences: { responseStyle: 'knapp', addressName: null, explainChanges: null, customInstructions: null },
});

const PROMPTS = [
  'Wie zentriere ich ein Div horizontal und vertikal?',
  'Was ist der Unterschied zwischen let und const in JavaScript?',
  'Bau mir einen einfachen Zähler-Button in HTML und stell ihn live.',
];

// Sentence counter: split on ., !, ? terminators (kept simple; code punctuation in
// backticks is stripped first so `display:flex;` etc. doesn't inflate the count).
function sentenceCount(text: string): number {
  const noCode = text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ');
  const parts = noCode.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 2);
  return parts.length;
}

// Promotional/pep closers the knapp style must NOT emit. The honest hand-off
// ("An Code senden") is explicitly allowed and NOT counted as a promo close.
const PROMO_RE = /(viel erfolg|viel spa[sß]|gern(e)? (weiter|behilflich)|melde dich|lass es mich wissen|wenn du (magst|willst|möchtest),? (kann|helfe)|happy coding|frag(e)? gern|zögere nicht|🚀|✨)/i;

async function ask(userText: string): Promise<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userText },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? '';
}

async function main() {
  let short = 0;
  const rows: string[] = [];
  for (const p of PROMPTS) {
    const reply = await ask(p);
    const sc = sentenceCount(reply);
    const promo = PROMO_RE.test(reply);
    const ok = sc <= 3 && !promo;
    if (ok) short++;
    rows.push(
      `\n── PROMPT: ${p}\n   sentences=${sc}  promoClose=${promo}  verdict=${ok ? 'SHORT ✓' : 'LONG ✗'}\n   REPLY: ${reply.replace(/\n/g, ' ⏎ ')}`,
    );
  }
  console.log('F-25 KNAPP PROBE — model:', MODEL);
  console.log(rows.join('\n'));
  console.log(`\nRESULT: ${short}/${PROMPTS.length} short (≤3 sentences, no promo close)`);
  process.exit(short === PROMPTS.length ? 0 : 1);
}

main().catch((e) => {
  console.error('probe failed:', e instanceof Error ? e.message : String(e));
  process.exit(3);
});
