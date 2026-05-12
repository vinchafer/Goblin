ALTER TABLE users ADD COLUMN IF NOT EXISTS default_chat_model TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_code_model TEXT;
