/**
 * WAVE D-G U3 — chat register probes against the REAL Goblin Swift model.
 * Three probes (a question, a task, a follow-up) capture the DEFAULT chat register
 * verbatim, before vs after the register touch-up. Isolation: both runs carry the
 * identical U2 design block; the only thing that changes between before/after is the
 * IDENTITY register wording. n=1 per probe, stochastic model — illustrative, not a rate.
 *
 * Usage: DEEPINFRA_API_KEY=… tsx scripts/dg-beauty/probe-register.ts <before|after>
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildGoblinChatSystemPrompt } from '../../apps/api/src/prompts/goblin-chat-system';

const BASE_URL = process.env.GOBLIN_HOSTED_BASE_URL || 'https://api.deepinfra.com/v1/openai';
const MODEL = process.env.GOBLIN_HOSTED_MODEL_EFFICIENT || 'deepseek-ai/DeepSeek-V3.2';

interface Probe {
  key: string;
  label: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const PROBES: Probe[] = [
  {
    key: '1-question',
    label: 'Frage',
    history: [{ role: 'user', content: 'Wie zentriere ich ein Div horizontal und vertikal?' }],
  },
  {
    key: '2-task',
    label: 'Aufgabe',
    history: [{ role: 'user', content: 'Baue mir einen Button, der bei Klick die Hintergrundfarbe der Seite wechselt.' }],
  },
  {
    key: '3-followup',
    label: 'Nachfrage',
    history: [
      { role: 'user', content: 'Baue mir einen Button, der bei Klick die Hintergrundfarbe der Seite wechselt.' },
      { role: 'assistant', content: 'Klar, hier ist ein Button mit einem kleinen Klick-Handler, der die Hintergrundfarbe umschaltet.' },
      { role: 'user', content: 'Danke! Kannst du ihn noch etwas abrunden und größer machen?' },
    ],
  },
];

async function run(probe: Probe, phase: string): Promise<void> {
  const systemPrompt = buildGoblinChatSystemPrompt({ projectName: 'Test-Projekt', files: [] });
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...probe.history],
      max_tokens: 1200,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`DeepInfra ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { choices: Array<{ message: { content: string } }>; usage: { completion_tokens: number } };
  const content = json.choices[0]?.message?.content ?? '';
  const outDir = join('evidence', 'dg-beauty', 'register', phase);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${probe.key}.md`), `# ${probe.label} (${phase})\n\nUser: ${probe.history[probe.history.length - 1]!.content}\n\n---\n\n${content}\n`);
  console.log(`[register ${phase}] ${probe.key} (${probe.label}): ${json.usage.completion_tokens} out tokens`);
}

async function main() {
  const phase = process.argv[2];
  if (phase !== 'before' && phase !== 'after') {
    console.error('usage: tsx probe-register.ts <before|after>');
    process.exit(1);
  }
  for (const p of PROBES) await run(p, phase);
}

main().catch((e) => { console.error(e); process.exit(1); });
