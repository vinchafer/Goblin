-- Drop the broken policy
DROP POLICY IF EXISTS "Users can access their own project files" ON storage.objects;

-- Create correct policy for SELECT (reading files)
CREATE POLICY "Users can read own project files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-files'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  )
);

-- Create correct policy for INSERT (saving files)
CREATE POLICY "Users can insert own project files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-files'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  )
);