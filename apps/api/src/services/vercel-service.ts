// DEPLOY-FIX [2026-04-29]:
// 1. Token cache never cleared on Vercel 401/403 → stale revoked tokens used indefinitely
// 2. content! null assertion → crash when a file fails to download from S3
// 3. >100 file truncation was silent → users received incomplete deploys without warning
// 4. getDeployStatus didn't check res.ok → returned UNKNOWN instead of proper error
import { getSupabaseAdmin } from '../lib/supabase';
import { decryptData } from './encryption';
import { listFiles, downloadFile } from './file-storage';

const _vercelTokenCache = new Map<string, string>();

function clearTokenCache(userId: string): void {
  _vercelTokenCache.delete(userId);
}

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
  if (!token) throw new Error('NO_VERCEL_TOKEN — add your Vercel token in Settings → API Keys');

  onProgress?.('Preparing files…');
  const files = await listFiles(projectId);

  if (files.length === 0) {
    throw new Error('Project has no files to deploy. Generate some code first.');
  }

  const filesToDeploy = files.slice(0, 100);
  if (files.length > 100) {
    onProgress?.(`⚠️ Project has ${files.length} files — deploying first 100 only (Vercel API limit)`);
  } else {
    onProgress?.(`Uploading ${filesToDeploy.length} files to Vercel…`);
  }

  const vercelFilesSettled = await Promise.allSettled(
    filesToDeploy.map(async (filePath) => {
      const content = await downloadFile(projectId, filePath);
      if (content === null) return null;
      return {
        file: filePath,
        data: Buffer.from(content).toString('base64'),
        encoding: 'base64' as const,
      };
    })
  );

  const vercelFiles = vercelFilesSettled
    .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof downloadFile>> extends string ? { file: string; data: string; encoding: 'base64' } : null>> =>
      r.status === 'fulfilled' && r.value !== null
    )
    .map(r => r.value as { file: string; data: string; encoding: 'base64' });

  if (vercelFiles.length === 0) {
    throw new Error('Failed to read any project files from storage.');
  }

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
    // Clear cached token on auth failure so next attempt re-fetches from DB
    if (res.status === 401 || res.status === 403) {
      clearTokenCache(userId);
      throw new Error('Vercel token rejected (401/403). Please update your Vercel token in Settings → API Keys.');
    }
    if (res.status === 429) {
      throw new Error('Vercel API rate limit reached. Wait a few minutes and try again.');
    }
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(`Vercel deploy failed: ${err.error?.message ?? res.statusText}`);
  }

  const data = await res.json() as { id: string; url: string };
  onProgress?.('Deployment created — waiting for build…');
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

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) clearTokenCache(userId);
    throw new Error(`Failed to get deployment status: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { readyState?: string; status?: string; url?: string };
  return {
    state: data.readyState ?? data.status ?? 'UNKNOWN',
    url: data.url ? `https://${data.url}` : undefined,
  };
}
