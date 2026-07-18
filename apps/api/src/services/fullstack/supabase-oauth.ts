// WAVE-B B1 — Supabase OAuth2 (user-connected shape, D-B1). Mirrors github-oauth.ts:
// build the authorize URL, exchange the code for an access token. All credentials come
// from server env (config.ts) — never hard-coded, never printed. The redirect_uri MUST
// byte-for-byte match the one registered on the Supabase OAuth app.

import {
  supabaseOAuthClientId,
  supabaseOAuthClientSecret,
  supabaseOAuthRedirectUri,
  SUPABASE_MGMT_API,
  SUPABASE_OAUTH_SCOPE,
} from './config';

/** A Supabase OAuth failure carries a short machine code so the callback can surface WHY
 *  without leaking secrets (e.g. 'missing_server_credentials'). */
export class SupabaseOAuthError extends Error {
  constructor(public code: string, message?: string) {
    super(message || code);
    this.name = 'SupabaseOAuthError';
  }
}

/** Build the authorize URL the browser is redirected to. `state` is the CSRF nonce. */
export function getAuthUrl(state: string): string {
  const clientId = supabaseOAuthClientId();
  const redirectUri = supabaseOAuthRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SUPABASE_OAUTH_SCOPE,
    state,
  });
  return `${SUPABASE_MGMT_API}/v1/oauth/authorize?${params.toString()}`;
}

export interface SupabaseTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

/** Exchange an authorization code for tokens (POST /v1/oauth/token, HTTP Basic client auth). */
export async function exchangeCodeForToken(code: string): Promise<SupabaseTokens> {
  const clientId = supabaseOAuthClientId();
  const clientSecret = supabaseOAuthClientSecret();
  if (!clientId || !clientSecret) {
    throw new SupabaseOAuthError(
      'missing_server_credentials',
      'SUPABASE_OAUTH_CLIENT_ID_RAILWAY / SUPABASE_OAUTH_CLIENT_SECRET_RAILWAY not set on the API',
    );
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: supabaseOAuthRedirectUri(),
  });

  const res = await fetch(`${SUPABASE_MGMT_API}/v1/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || data.error || !data.access_token) {
    throw new SupabaseOAuthError(
      data.error || `http_${res.status}`,
      data.error_description || 'Supabase token exchange failed',
    );
  }

  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}
