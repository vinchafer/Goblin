// The redirect_uri MUST byte-for-byte match the GitHub OAuth App's single
// registered "Authorization callback URL". Prefer the explicit env var; fall
// back to deriving it from the API's public URL so a missing/stale var can't
// silently send a redirect_uri GitHub rejects ("redirect_uri is not associated
// with this application"). See sprint-10-5/GITHUB_OAUTH_FOUNDER_ACTION.md.
export function getRedirectUri(): string {
  const explicit = process.env.GITHUB_REDIRECT_URI_RAILWAY;
  if (explicit) return explicit;
  const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
  return `${apiBase}/api/github/callback`;
}

export function getAuthUrl(state: string): string {
  const clientId = process.env.GITHUB_CLIENT_ID_RAILWAY!;
  const redirectUri = getRedirectUri();
  const scope = 'repo user';

  return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const clientId = process.env.GITHUB_CLIENT_ID_RAILWAY!;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET_RAILWAY!;

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      // Include redirect_uri so the token exchange matches the authorize step.
      redirect_uri: getRedirectUri()
    })
  });

  const data = await response.json() as { access_token?: string; error?: string; error_description?: string };

  if (!response.ok || data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || 'GitHub OAuth failed');
  }

  return data.access_token;
}

export async function getUsername(accessToken: string): Promise<string> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  const data = await response.json();
  return data.login;
}