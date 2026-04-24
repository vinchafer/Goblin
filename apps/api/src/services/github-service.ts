import { Octokit } from '@octokit/rest';
import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt } from './encryption';

interface RepoOptions {
  name: string;
  description?: string;
  isPrivate?: boolean;
}

interface RepoFile {
  path: string;
  content: string;
}

export async function getDecryptedAccessToken(userId: string): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('users')
    .select('github_access_token_encrypted')
    .eq('id', userId)
    .single();

  if (!data?.github_access_token_encrypted) {
    return null;
  }

  return decrypt(data.github_access_token_encrypted);
}

export async function createRepo(accessToken: string, options: RepoOptions): Promise<{ owner: string; repo: string; url: string }> {
  const octokit = new Octokit({ auth: accessToken });

  const response = await octokit.repos.createForAuthenticatedUser({
    name: options.name,
    description: options.description,
    private: options.isPrivate ?? true,
    auto_init: false
  });

  return {
    owner: response.data.owner.login,
    repo: response.data.name,
    url: response.data.html_url
  };
}

export async function pushFiles(accessToken: string, owner: string, repo: string, files: RepoFile[]): Promise<void> {
  const octokit = new Octokit({ auth: accessToken });

  for (const file of files) {
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: file.path,
      message: `Add ${file.path}`,
      content: Buffer.from(file.content).toString('base64')
    });
  }
}

export async function disconnectGitHub(userId: string): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase
    .from('users')
    .update({
      github_username: null,
      github_access_token_encrypted: null,
      github_connected_at: null
    })
    .eq('id', userId);
}

export async function saveGitHubConnection(userId: string, accessToken: string, username: string): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const encryptedToken = encrypt(accessToken);

  await supabase
    .from('users')
    .update({
      github_username: username,
      github_access_token_encrypted: encryptedToken,
      github_connected_at: new Date().toISOString()
    })
    .eq('id', userId);
}