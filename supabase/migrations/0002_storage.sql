-- Create storage bucket for project files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('project-files', 'project-files', false, 52428800, ARRAY['text/*', 'application/json', 'image/*']);

-- RLS policy for project files bucket (corrected in 0006, placeholder here)
-- 0006_fix_storage_rls.sql creates the correct policies with ::uuid cast