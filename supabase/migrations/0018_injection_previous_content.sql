ALTER TABLE code_injections ADD COLUMN IF NOT EXISTS previous_content TEXT;
ALTER TABLE code_injections ADD COLUMN IF NOT EXISTS applied_file_path TEXT;
