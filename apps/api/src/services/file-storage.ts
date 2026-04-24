import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

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

export async function listFiles(projectId: string): Promise<string[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase.storage
    .from(BUCKET_NAME)
    .list(projectId, { limit: 1000 });

  return data?.map(item => `${projectId}/${item.name}`) || [];
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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const zip = new JSZip();

  const { data: files } = await supabase.storage
    .from(BUCKET_NAME)
    .list(projectId, { limit: 1000 });

  if (!files) {
    return Buffer.from('');
  }

  for (const file of files) {
    const { data: content } = await supabase.storage
      .from(BUCKET_NAME)
      .download(`${projectId}/${file.name}`);

    if (content) {
      zip.file(file.name, await content.text());
    }
  }

  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}