-- Expand byok_keys.provider CHECK constraint to all v6 supported providers
-- Original only had: 'anthropic', 'openai', 'together', 'fireworks'
-- v6 adds: google, groq, mistral, deepseek, xai

ALTER TABLE byok_keys DROP CONSTRAINT IF EXISTS byok_keys_provider_check;

ALTER TABLE byok_keys
  ADD CONSTRAINT byok_keys_provider_check
  CHECK (provider IN ('anthropic', 'openai', 'google', 'groq', 'mistral', 'deepseek', 'xai', 'together', 'fireworks'));
