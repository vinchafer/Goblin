/**
 * Seed script for models table.
 * Run this in Supabase Studio SQL Editor or via CLI:
 * 
 * psql -h db.supabase.co -p 5432 -d postgres -U postgres -f seed-models.sql
 * 
 * Or copy-paste the SQL below into Supabase Studio.
 */

const SQL = `
-- Clear existing data (optional)
-- DELETE FROM models;

-- Insert Phase 1-3 models
INSERT INTO models (name, slug, provider, layer, description, tags, requires_key, available, phase)
VALUES
  -- Phase 1: BYOK Models
  ('Claude Sonnet 4.6', 'claude-sonnet-4-6', 'anthropic', 'byok', 'Best for coding', ARRAY['coding','fast'], true, true, 1),
  ('Claude Opus 4.7', 'claude-opus-4-7', 'anthropic', 'byok', 'Most powerful. Best for complex reasoning.', ARRAY['reasoning','coding'], true, true, 1),
  ('GPT-4o', 'gpt-4o', 'openai', 'byok', 'OpenAI flagship', ARRAY['coding','reasoning'], true, true, 1),
  ('DeepSeek V3', 'deepseek-chat', 'deepseek', 'byok', 'Best price/performance', ARRAY['coding','cheap'], true, true, 1),
  ('Gemini 2.0 Flash', 'gemini-2.0-flash', 'google', 'byok', 'Very fast. Great for quick iterations.', ARRAY['fast'], true, true, 1),
  ('Llama 3.3 70B (Groq)', 'llama-3.3-70b-versatile', 'groq', 'byok', 'Open-source 70B. Extremely fast via Groq inference.', ARRAY['fast','coding'], true, true, 1),
  ('Mistral Large', 'mistral-large', 'mistral', 'byok', 'European LLM. Strong multilingual support.', ARRAY['multilingual','coding'], true, true, 1),
  ('Grok 2', 'grok-2', 'xai', 'byok', 'Elon''s model. Good reasoning and real-time knowledge.', ARRAY['reasoning','knowledge'], true, true, 1),
  ('Llama 3 70B (Together)', 'llama-3-70b', 'together', 'byok', 'Open-source 70B via Together AI. Access many open models.', ARRAY['open-source','coding'], true, true, 1),
  
  -- Phase 2: Free API Models (no key required)
  ('Gemini 2.0 Flash', 'gemini-2.0-flash-free', 'google', 'free_api', 'Fast, generous free tier. No key required.', ARRAY['fast','free'], false, true, 2),
  ('Llama 3.3 70B', 'llama-3.3-70b-free', 'groq', 'free_api', 'Extremely fast inference. Free tier available.', ARRAY['fast','free','coding'], false, true, 2),
  
  -- Phase 3: Goblin Hosted (GPU)
  ('Qwen 2.5 Coder 32B', 'qwen2.5-coder-32b-instruct', 'goblin', 'goblin_hosted', 'Goblin GPU — unlimited', ARRAY['coding','unlimited'], false, false, 3)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  provider = EXCLUDED.provider,
  layer = EXCLUDED.layer,
  description = EXCLUDED.description,
  tags = EXCLUDED.tags,
  requires_key = EXCLUDED.requires_key,
  available = EXCLUDED.available,
  phase = EXCLUDED.phase;

-- Mark Goblin Hosted as available if GPU endpoint is configured
UPDATE models 
SET available = CASE 
  WHEN layer = 'goblin_hosted' AND EXISTS (
    SELECT 1 FROM pg_settings WHERE name = 'app.goblin_gpu_endpoint' AND setting != ''
  ) THEN true
  WHEN layer = 'goblin_hosted' THEN false
  ELSE available
END
WHERE layer = 'goblin_hosted';
`;

console.log('Copy the SQL below and run it in Supabase Studio SQL Editor:');
console.log('===========================================================');
console.log(SQL);
console.log('===========================================================');
console.log('\nOr run via CLI:');
console.log('psql -h db.supabase.co -p 5432 -d postgres -U postgres -c "' + SQL.replace(/\n/g, ' ') + '"');

export {};