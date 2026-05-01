-- Ensure models table exists (may already exist from 0009)
CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  layer TEXT NOT NULL DEFAULT 'byok',
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  requires_key BOOLEAN DEFAULT true,
  available BOOLEAN DEFAULT true,
  phase INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed BYOK models
INSERT INTO models (id, name, slug, provider, layer, description, tags, requires_key, available, phase) VALUES
-- Anthropic
('claude-opus-4-5',   'Claude Opus 4.5',   'anthropic/claude-opus-4-5',   'anthropic', 'byok', 'Most powerful Claude. Best for complex reasoning.', ARRAY['reasoning','coding','powerful'], true, true, 1),
('claude-sonnet-4-6', 'Claude Sonnet 4.6', 'anthropic/claude-sonnet-4-6', 'anthropic', 'byok', 'Fast, highly capable. Best for most coding tasks.', ARRAY['coding','fast','balanced'], true, true, 1),
('claude-haiku-4-5',  'Claude Haiku 4.5',  'anthropic/claude-haiku-4-5',  'anthropic', 'byok', 'Fastest, cheapest Claude.', ARRAY['fast','cheap'], true, true, 1),
-- OpenAI
('gpt-4o',      'GPT-4o',      'openai/gpt-4o',      'openai', 'byok', 'OpenAI flagship. Strong at code and instruction following.', ARRAY['coding','fast','balanced'], true, true, 1),
('gpt-4o-mini', 'GPT-4o Mini', 'openai/gpt-4o-mini', 'openai', 'byok', 'Small, fast, cheap.', ARRAY['fast','cheap'], true, true, 1),
('o1',          'o1',          'openai/o1',           'openai', 'byok', 'Extended reasoning model.', ARRAY['reasoning','powerful'], true, true, 1),
('o3-mini',     'o3-mini',     'openai/o3-mini',      'openai', 'byok', 'Efficient reasoning model.', ARRAY['reasoning','fast'], true, true, 1),
-- Google
('gemini-2.0-flash', 'Gemini 2.0 Flash', 'gemini/gemini-2.0-flash', 'google', 'byok', 'Very fast. Great for quick iterations.', ARRAY['fast'], true, true, 1),
('gemini-1.5-pro',   'Gemini 1.5 Pro',   'gemini/gemini-1.5-pro',   'google', 'byok', 'Long context (1M tokens).', ARRAY['long-context','coding'], true, true, 1),
-- Groq
('llama-3.3-70b',  'Llama 3.3 70B', 'groq/llama-3.3-70b-versatile', 'groq', 'byok', 'Extremely fast via Groq inference.', ARRAY['fast','coding','open-source'], true, true, 1),
('mixtral-8x7b',   'Mixtral 8x7B',  'groq/mixtral-8x7b-32768',      'groq', 'byok', 'Fast and multilingual.', ARRAY['fast','multilingual'], true, true, 1),
-- Mistral
('mistral-large', 'Mistral Large', 'mistral/mistral-large-latest', 'mistral', 'byok', 'Flagship Mistral. Strong multilingual support.', ARRAY['multilingual','coding'], true, true, 1),
('mistral-small', 'Mistral Small', 'mistral/mistral-small-latest', 'mistral', 'byok', 'Cost-effective for most tasks.', ARRAY['fast','cheap'], true, true, 1),
-- xAI
('grok-3',      'Grok 3',      'xai/grok-3',      'xai', 'byok', 'Latest Grok. Powerful reasoning.', ARRAY['reasoning','knowledge'], true, true, 1),
('grok-3-mini', 'Grok 3 Mini', 'xai/grok-3-mini', 'xai', 'byok', 'Compact Grok. Fast and cost-effective.', ARRAY['fast','cheap'], true, true, 1),
-- DeepSeek
('deepseek-v3', 'DeepSeek V3', 'deepseek/deepseek-chat',     'deepseek', 'byok', 'Best price/performance for coding.', ARRAY['coding','cheap','fast'], true, true, 1),
('deepseek-r1', 'DeepSeek R1', 'deepseek/deepseek-reasoner', 'deepseek', 'byok', 'Chain-of-thought reasoning.', ARRAY['reasoning','open-source'], true, true, 1),
-- Together
('llama-3.3-70b-turbo', 'Llama 3.3 70B (Together)', 'together_ai/meta-llama/Llama-3.3-70B-Instruct-Turbo', 'together', 'byok', 'Open-source 70B via Together AI.', ARRAY['open-source','coding'], true, true, 1),
-- Fireworks
('llama-v3p3-70b', 'Llama 3.3 70B (Fireworks)', 'fireworks_ai/accounts/fireworks/models/llama-v3p3-70b-instruct', 'fireworks', 'byok', 'Fast open-source 70B via Fireworks.', ARRAY['fast','open-source','coding'], true, true, 1),
-- Free API
('gemini-2.0-flash-free', 'Gemini 2.0 Flash', 'free/gemini-flash', 'google', 'free_api', 'Fast, generous free tier. No key required.', ARRAY['fast','free'], false, true, 1),
('llama-3.3-70b-free',    'Llama 3.3 70B',    'free/llama-70b',    'groq',   'free_api', 'Extremely fast inference. Free tier available.', ARRAY['fast','free','coding'], false, true, 1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  tags = EXCLUDED.tags,
  available = EXCLUDED.available;

-- Add user fallback chain column if it doesn't exist
ALTER TABLE projects ADD COLUMN IF NOT EXISTS model_preferences JSONB DEFAULT '{}';
