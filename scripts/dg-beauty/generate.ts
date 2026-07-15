/**
 * WAVE D-G — generation-beauty harness.
 *
 * Calls the REAL "Goblin Swift" model (DeepSeek V3.2 on DeepInfra — the exact wholesale
 * slug production routes to, see apps/api/src/services/goblin-hosted.ts) with the EXACT
 * production chat code-gen system prompt (buildGoblinChatSystemPrompt). This is the
 * chat code-gen path — a fresh project, the user types "Baue mir …", the model streams
 * back fenced code blocks with filenames, which we extract to disk and render locally.
 *
 * It is NOT a prod-UI walk: this session has no test-account credentials. It IS the
 * real shipping model + the real shipping system prompt, so the before/after delta is a
 * faithful measurement of the prompt change — the only variable that moves between the
 * BEFORE and AFTER runs is APP_DESIGN_FOUNDATION / its injection.
 *
 * Usage: DEEPINFRA_API_KEY=… tsx scripts/dg-beauty/generate.ts <before|after> [archetype]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { buildGoblinChatSystemPrompt } from '../../apps/api/src/prompts/goblin-chat-system';

const BASE_URL = process.env.GOBLIN_HOSTED_BASE_URL || 'https://api.deepinfra.com/v1/openai';
const MODEL = process.env.GOBLIN_HOSTED_MODEL_EFFICIENT || 'deepseek-ai/DeepSeek-V3.2';
const MAX_TOKENS = 8096;

interface Archetype {
  key: string;
  projectName: string;
  prompt: string;
}

// The founder's three verbatim archetype prompts (A-2 beauty gate).
const ARCHETYPES: Archetype[] = [
  {
    key: 'A-habit',
    projectName: 'Habit-Tracker',
    prompt:
      'Baue mir einen kleinen Habit-Tracker: Gewohnheiten anlegen, täglich abhaken, Streak sehen — localStorage, deutsche Oberfläche.',
  },
  {
    key: 'B-pasta',
    projectName: 'Pasta-Rezepte',
    prompt:
      'Baue eine Rezept-Seite für meine liebsten Pasta-Gerichte mit einer Übersicht und Detailansichten.',
  },
  {
    key: 'C-hundeverein',
    projectName: 'Hundeverein',
    prompt:
      'Baue eine Seite für meinen Hundeverein: Startseite mit den nächsten Terminen und einer Kontakt-Sektion.',
  },
];

/** Extract fenced code blocks (```lang path\n…```) into { path -> content }. Falls back
 *  to a single index.html when the model returns one unnamed HTML block. */
function extractFiles(text: string): Record<string, string> {
  const files: Record<string, string> = {};
  const fence = /```([^\n`]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = fence.exec(text)) !== null) {
    const info = (m[1] || '').trim();
    const body = m[2] ?? '';
    // info string is like "html index.html" or "css styles.css" or just "html"
    const parts = info.split(/\s+/).filter(Boolean);
    let path = parts.find((p) => p.includes('.')) || '';
    if (!path) {
      const lang = parts[0] || '';
      const ext = lang === 'html' ? 'html' : lang === 'css' ? 'css' : lang === 'js' || lang === 'javascript' ? 'js' : lang || 'txt';
      path = idx === 0 && ext === 'html' ? 'index.html' : `file-${idx}.${ext}`;
    }
    files[path] = body;
    idx++;
  }
  return files;
}

async function generate(a: Archetype, phase: string): Promise<void> {
  const systemPrompt = buildGoblinChatSystemPrompt({ projectName: a.projectName, files: [] });
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: a.prompt },
    ],
    max_tokens: MAX_TOKENS,
    temperature: 0.7,
  };

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`DeepInfra ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    choices: Array<{ message: { content: string }; finish_reason: string }>;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number; estimated_cost?: number };
  };
  const content = json.choices[0]?.message?.content ?? '';
  const finish = json.choices[0]?.finish_reason ?? '';
  const files = extractFiles(content);

  const outDir = join('evidence', 'dg-beauty', phase, a.key);
  mkdirSync(outDir, { recursive: true });
  // Raw model output (full response, for audit) + each extracted file.
  writeFileSync(join(outDir, '_raw.md'), content);
  for (const [path, body] of Object.entries(files)) {
    const full = join(outDir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  const meta = {
    archetype: a.key,
    phase,
    model: MODEL,
    systemPromptChars: systemPrompt.length,
    prompt: a.prompt,
    finish_reason: finish,
    usage: json.usage,
    files: Object.keys(files),
  };
  writeFileSync(join(outDir, '_meta.json'), JSON.stringify(meta, null, 2));
  console.log(
    `[${phase}] ${a.key}: ${Object.keys(files).length} file(s) [${Object.keys(files).join(', ')}] · ` +
      `in=${json.usage.prompt_tokens} out=${json.usage.completion_tokens} finish=${finish} ` +
      `cost≈$${(json.usage.estimated_cost ?? 0).toFixed(5)}`,
  );
}

async function main() {
  const phase = process.argv[2];
  const only = process.argv[3];
  if (phase !== 'before' && phase !== 'after') {
    console.error('usage: tsx generate.ts <before|after> [archetypeKey]');
    process.exit(1);
  }
  const list = only ? ARCHETYPES.filter((a) => a.key === only) : ARCHETYPES;
  for (const a of list) {
    await generate(a, phase);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
