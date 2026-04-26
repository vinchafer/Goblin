-- DB-driven model registry (v6 architecture)
CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL,
  layer TEXT CHECK (layer IN ('goblin_hosted', 'free_api', 'byok')) NOT NULL DEFAULT 'byok',
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  requires_key BOOLEAN DEFAULT true,
  available BOOLEAN DEFAULT true,
  phase INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Public read (anyone with anon key can list available models)
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Models are publicly readable" ON models FOR SELECT USING (true);

-- Seed Phase 1 models
INSERT INTO models (name, slug, provider, layer, description, tags, requires_key, available, phase) VALUES
  ('Claude Sonnet 4.6',    'claude-sonnet-4-6',                 'anthropic', 'byok', 'Fast, capable. Best for most coding tasks.',             ARRAY['coding','fast'],          true,  true,  1),
  ('Claude Opus 4.7',      'claude-opus-4-7',                   'anthropic', 'byok', 'Most powerful. Best for complex reasoning.',              ARRAY['reasoning','coding'],     true,  true,  1),
  ('GPT-4o',               'gpt-4o',                            'openai',    'byok', 'OpenAI flagship. Strong at code and instructions.',       ARRAY['coding','fast'],          true,  true,  1),
  ('DeepSeek V3',          'deepseek/deepseek-chat',            'deepseek',  'byok', 'Best price/performance for coding.',                      ARRAY['coding','fast'],          true,  true,  1),
  ('Gemini 2.0 Flash',     'gemini/gemini-2.0-flash',           'google',    'byok', 'Very fast. Great for quick iterations.',                  ARRAY['fast'],                   true,  true,  1),
  ('Llama 3.3 70B (Groq)', 'groq/llama-3.3-70b-versatile',     'groq',      'byok', 'Open-source 70B. Extremely fast via Groq.',               ARRAY['fast','coding'],          true,  true,  1),
  ('Mistral Large',        'mistral-large-latest',              'mistral',   'byok', 'Mistral flagship. Good at code and reasoning.',           ARRAY['coding','reasoning'],     true,  true,  1),
  ('Grok 2',               'xai/grok-2-1212',                   'xai',       'byok', 'xAI model with strong reasoning capabilities.',           ARRAY['reasoning'],              true,  true,  1),
  ('Qwen Coder 32B',       'qwen-coder-32b',                    'goblin',    'goblin_hosted', 'Goblin-hosted. No key required.',                ARRAY['coding','hosted'],        false, false, 3),
  ('Gemini 2.0 Flash',     'free/gemini-2.0-flash',             'google',    'free_api', 'Free tier via Goblin pool. When available.',         ARRAY['fast','free'],            false, false, 2),
  ('Llama 3.3 70B (Free)', 'free/groq-llama-3.3-70b',          'groq',      'free_api', 'Free tier via Goblin Groq key. When available.',      ARRAY['fast','free'],            false, false, 2)
ON CONFLICT (slug) DO NOTHING;
