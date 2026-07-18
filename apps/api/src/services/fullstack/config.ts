// WAVE-B B1 — full-stack provisioning config (pure, no network). ONE config module.
//
// Everything here is KEY-AGNOSTIC: no secret value lives in code. The OAuth client_id /
// client_secret and the redirect URI are read from server env (the founder sets them in
// Railway — never in this session). `GOBLIN_FULLSTACK_ENABLED` is the master opt-in flag:
// while it is off (the default), the provisioning tool is NOT advertised to the agent and
// the capability prompt block is absent, so every existing static AND framework run is
// byte-identical to today (LIVE-USERS: additive / opt-in). The founder flips it on after
// wiring the OAuth app + applying migration 0096.

/** Master opt-in. Off by default → no behavior change for existing users. */
export function fullstackEnabled(): boolean {
  return process.env.GOBLIN_FULLSTACK_ENABLED === 'true';
}

/** Supabase OAuth app client id (public-ish). Env only — never hard-coded. */
export function supabaseOAuthClientId(): string {
  return process.env.SUPABASE_OAUTH_CLIENT_ID_RAILWAY || process.env.SUPABASE_OAUTH_CLIENT_ID || '';
}

/** Supabase OAuth app client secret. Env only. NEVER printed, logged, or returned. */
export function supabaseOAuthClientSecret(): string {
  return process.env.SUPABASE_OAUTH_CLIENT_SECRET_RAILWAY || process.env.SUPABASE_OAUTH_CLIENT_SECRET || '';
}

/**
 * The OAuth redirect_uri. MUST byte-for-byte match the URI registered on the Supabase
 * OAuth app (mirrors the GitHub connector's getRedirectUri). Prefer the explicit env var;
 * fall back to deriving it from the API's public URL so a missing var can't silently send
 * a redirect_uri Supabase rejects.
 */
export function supabaseOAuthRedirectUri(): string {
  const explicit = process.env.SUPABASE_OAUTH_REDIRECT_URI_RAILWAY || process.env.SUPABASE_OAUTH_REDIRECT_URI;
  if (explicit) return explicit;
  const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
  return `${apiBase}/api/supabase/callback`;
}

/**
 * Default region for provisioned backends. Frankfurt (eu-central-1) per the spike's
 * EU-first recommendation; overridable by env without a code change.
 */
export function defaultBackendRegion(): string {
  return process.env.GOBLIN_FULLSTACK_DEFAULT_REGION || 'eu-central-1';
}

/** The Supabase Management API base. Constant, but centralized so tests can point elsewhere. */
export const SUPABASE_MGMT_API = 'https://api.supabase.com';

/** OAuth scope requested — project create/manage inside the user's org (user-connected shape). */
export const SUPABASE_OAUTH_SCOPE = 'all';
