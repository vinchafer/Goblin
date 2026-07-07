-- FEEL-4 F4.3 — allow storing a user's own Brave Search key in byok_keys.
--
-- AUTHORED, NOT APPLIED (sprint hard rule): the founder applies this after merge.
-- 'brave' is a CONNECTION provider (like 'vercel'), not an LLM provider — it never
-- enters the model catalog. The live DB already tolerates connection providers such
-- as 'vercel' that predate the 0013 CHECK constraint (Vercel connect works in prod),
-- so the user-key path may already store 'brave' before this runs; applying it just
-- makes the allowance explicit and keeps 'vercel' in the list. Idempotent + additive.

ALTER TABLE byok_keys DROP CONSTRAINT IF EXISTS byok_keys_provider_check;
ALTER TABLE byok_keys
  ADD CONSTRAINT byok_keys_provider_check
  CHECK (provider IN (
    'anthropic', 'openai', 'google', 'groq', 'mistral', 'deepseek', 'xai',
    'together', 'fireworks', 'custom', 'vercel', 'brave'
  ));
