export function getAuthUrl(state: string): string {
  const clientId = process.env.GITHUB_CLIENT_ID_RAILWAY!;
  const redirectUri = process.env.GITHUB_REDIRECT_URI_RAILWAY!;
  const scope = 'repo user';

  return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
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
      code
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