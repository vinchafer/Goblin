import { getSupabaseAdmin } from '../lib/supabase';
import { decryptData } from './encryption';
import { listFiles, downloadFile } from './file-storage';

let _vercelTokenCache = new Map<string, string>();

async function getUserVercelToken(userId: string): Promise<string | null> {
  if (_vercelTokenCache.has(userId)) return _vercelTokenCache.get(userId)!;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('byok_keys')
    .select('key_encrypted')
    .eq('user_id', userId)
    .eq('provider', 'vercel')
    .eq('status', 'active')
    .single();
  if (!data) return null;
  const token = decryptData(data.key_encrypted);
  _vercelTokenCache.set(userId, token);
  return token;
}

export async function deployToVercel(
  userId: string,
  projectId: string,
  projectName: string,
  onProgress?: (msg: string) => void,
): Promise<{ deploymentId: string; url: string }> {
  const token = await getUserVercelToken(userId);
  if (!token) throw new Error('NO_VERCEL_TOKEN');

  onProgress?.('Preparing files…');
  const files = await listFiles(projectId);

  onProgress?.(`Uploading ${files.length} files to Vercel…`);

  // Limit to 100 files max for the Vercel API
  const vercelFiles = await Promise.all(
    files.slice(0, 100).map(async (filePath) => {
      const content = await downloadFile(projectId, filePath);
      return {
        file: filePath,
        data: Buffer.from(content!).toString('base64'),
        encoding: 'base64' as const,
      };
    })
  );

  onProgress?.('Creating deployment…');
  const res = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 52),
      files: vercelFiles,
      projectSettings: { framework: null },
      target: 'production',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Vercel deploy failed: ${(err as any).error?.message ?? res.statusText}`);
  }

  const data = await res.json() as { id: string; url: string };
  return { deploymentId: data.id, url: `https://${data.url}` };
}

export async function getDeployStatus(
  userId: string,
  deploymentId: string,
): Promise<{ state: string; url?: string }> {
  const token = await getUserVercelToken(userId);
  if (!token) throw new Error('No Vercel token');

  const res = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json() as { readyState?: string; status?: string; url?: string };
  return {
    state: data.readyState ?? data.status ?? 'UNKNOWN',
    url: data.url ? `https://${data.url}` : undefined,
  };
}