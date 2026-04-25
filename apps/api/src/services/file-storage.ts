import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'project-files';

export async function saveFile(projectId: string, path: string, content: string): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const fullPath = `${projectId}/${path}`;

  await supabase.storage
    .from(BUCKET_NAME)
    .upload(fullPath, content, {
      upsert: true,
      contentType: 'text/plain'
    });
}

export async function getFile(projectId: string, path: string): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase.storage
    .from(BUCKET_NAME)
    .download(`${projectId}/${path}`);

  return data ? await data.text() : null;
}

async function listFilesRecursive(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const { data } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (!data) return [];
  
  const results: string[] = [];
  
  for (const item of data) {
    if (item.id === null) {
      // This is a folder
      const subItems = await listFilesRecursive(supabase, bucket, `${prefix}/${item.name}`);
      results.push(...subItems);
    } else {
      results.push(`${prefix}/${item.name}`);
    }
  }

  return results;
}

export async function listFiles(projectId: string): Promise<string[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const fullPaths = await listFilesRecursive(supabase, BUCKET_NAME, projectId);
  
  // Strip off the leading projectId prefix
  return fullPaths.map(path => path.slice(projectId.length + 1));
}

export async function deleteFile(projectId: string, path: string): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase.storage
    .from(BUCKET_NAME)
    .remove([`${projectId}/${path}`]);
}

export async function createZip(projectId: string): Promise<Buffer> {
  const zip = new JSZip();

  const files = await listFiles(projectId);

  for (const filePath of files) {
    const content = await getFile(projectId, filePath);
    if (content) {
      zip.file(filePath, content);
    }
  }

  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}