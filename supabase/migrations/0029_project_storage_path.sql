-- Add storage_path column to projects (used by file storage service)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS storage_path TEXT;
