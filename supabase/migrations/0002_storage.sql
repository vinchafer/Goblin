-- Create storage bucket for project files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('project-files', 'project-files', false, 52428800, ARRAY['text/*', 'application/json', 'image/*']);

-- RLS policy for project files bucket
CREATE POLICY "Users can access their own project files"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'project-files'
  AND (storage.foldername(name))[1] IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  )
);