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

// Env names are suffixed `_RAILWAY` (the prod host), but a founder may set the
// bare name — accept both so a name-mismatch can't silently break the exchange.
function ghClientId(): string {
  return process.env.GITHUB_CLIENT_ID_RAILWAY || process.env.GITHUB_CLIENT_ID || '';
}
function ghClientSecret(): string {
  return process.env.GITHUB_CLIENT_SECRET_RAILWAY || process.env.GITHUB_CLIENT_SECRET || '';
}

export function getAuthUrl(state: string): string {
  const clientId = ghClientId();
  const redirectUri = getRedirectUri();
  const scope = 'repo user';

  return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
}

/** A GitHub OAuth failure carries a short machine code so the callback can surface
 *  WHY without leaking secrets (e.g. 'incorrect_client_credentials'). */
export class GitHubOAuthError extends Error {
  constructor(public code: string, message?: string) {
    super(message || code);
    this.name = 'GitHubOAuthError';
  }
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const clientId = ghClientId();
  const clientSecret = ghClientSecret();
  if (!clientId || !clientSecret) {
    // WALK3-1: the most likely prod cause of "GitHub reopens settings" — the
    // server has no client credentials, so the token exchange can never succeed.
    throw new GitHubOAuthError('missing_server_credentials', 'GITHUB_CLIENT_ID_RAILWAY / GITHUB_CLIENT_SECRET_RAILWAY not set on the API');
  }

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

  const data = await response.json().catch(() => ({})) as { access_token?: string; error?: string; error_description?: string };

  if (!response.ok || data.error || !data.access_token) {
    // data.error is GitHub's machine code, e.g. 'incorrect_client_credentials',
    // 'bad_verification_code', 'redirect_uri_mismatch'.
    throw new GitHubOAuthError(data.error || `http_${response.status}`, data.error_description || 'GitHub token exchange failed');
  }

  return data.access_token;
}

export async function getUsername(accessToken: string): Promise<string> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'goblin-app',
    }
  });

  const data = await response.json().catch(() => ({})) as { login?: string };
  if (!data.login) {
    throw new GitHubOAuthError('user_lookup_failed', 'GitHub /user returned no login');
  }
  return data.login;
}