/**
 * WAVE D-G U2 — exact token cost of APP_DESIGN_FOUNDATION, measured with the REAL
 * DeepInfra tokenizer (prompt_tokens with the block vs with it spliced out). Feeds the
 * consumption-ledger NOTE. Usage: DEEPINFRA_API_KEY=… tsx scripts/dg-beauty/measure-block.ts
 */
import { buildGoblinChatSystemPrompt } from '../../apps/api/src/prompts/goblin-chat-system';
import { APP_DESIGN_FOUNDATION } from '../../apps/api/src/prompts/app-design-foundation';

const BASE = 'https://api.deepinfra.com/v1/openai';
const MODEL = 'deepseek-ai/DeepSeek-V3.2';

async function promptTokens(system: string): Promise<number> {
  const r = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: 'x' }], max_tokens: 1 }),
  });
  const j = (await r.json()) as { usage: { prompt_tokens: number } };
  return j.usage.prompt_tokens;
}

async function main() {
  const withBlock = buildGoblinChatSystemPrompt({ projectName: 'Test', files: [] });
  const withoutBlock = withBlock.replace('\n' + APP_DESIGN_FOUNDATION, '');
  const a = await promptTokens(withBlock);
  const b = await promptTokens(withoutBlock);
  console.log('block chars  :', APP_DESIGN_FOUNDATION.length);
  console.log('with block   :', a);
  console.log('without block:', b);
  console.log('BLOCK COST   :', a - b, 'input tokens (exact, DeepInfra tokenizer)');
}
main().catch((e) => { console.error(e); process.exit(1); });
