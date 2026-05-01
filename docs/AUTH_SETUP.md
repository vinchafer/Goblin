# Goblin — Auth Setup Guide

Social OAuth only. No magic links. No passwords.

---

## Callback URL

All providers use the same Supabase callback:

```
https://<your-supabase-project>.supabase.co/auth/v1/callback
```

For local dev:

```
http://localhost:3000/auth/callback
```

---

## 1. Google OAuth

### Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create or select a project
3. APIs & Services → Credentials → Create Credentials → OAuth client ID
4. Application type: **Web application**
5. Name: `Goblin`
6. Authorized redirect URIs:
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
7. Copy **Client ID** and **Client Secret**

### Supabase Dashboard

1. Auth → Providers → Google → Enable
2. Paste Client ID and Client Secret
3. Save

### Additional: OAuth Consent Screen

- App name: `Goblin`
- Scopes: `email`, `profile` (default)
- Publishing status: Production (once verified)

---

## 2. GitHub OAuth

### GitHub Developer Settings

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. OAuth Apps → New OAuth App
3. Fill in:
   - **Application name**: `Goblin`
   - **Homepage URL**: `https://justgoblin.com`
   - **Authorization callback URL**:
     ```
     https://<project-ref>.supabase.co/auth/v1/callback
     ```
4. Register application
5. Generate a new client secret
6. Copy **Client ID** and **Client Secret**

### Supabase Dashboard

1. Auth → Providers → GitHub → Enable
2. Paste Client ID and Client Secret
3. Save

---

## 3. Apple Sign In

### Apple Developer Account

1. Go to [developer.apple.com](https://developer.apple.com)
2. Certificates, Identifiers & Profiles → Identifiers → App IDs
3. Register a new App ID with **Sign In with Apple** capability
4. Identifiers → Services IDs → Register new
   - Description: `Goblin`
   - Identifier: `com.justgoblin.web` (must be unique)
   - Enable **Sign In with Apple** → Configure
   - Primary App ID: select the App ID from above
   - Domains: `justgoblin.com`
   - Return URLs:
     ```
     https://<project-ref>.supabase.co/auth/v1/callback
     ```
5. Keys → Register a new key
   - Enable **Sign In with Apple** → Configure → select your App ID
   - Download the `.p8` private key file (download once only)
   - Note the **Key ID**

### Values needed for Supabase

| Field | Where to find |
|---|---|
| Service ID | The identifier you created (e.g. `com.justgoblin.web`) |
| Team ID | Your Apple Developer Team ID (top-right in developer portal) |
| Key ID | From the key you just created |
| Private Key | Content of the `.p8` file |

### Supabase Dashboard

1. Auth → Providers → Apple → Enable
2. Paste all four values
3. Save

---

## 4. Supabase Auth Settings

### After setting up all providers

1. Auth → URL Configuration:
   - Site URL: `https://justgoblin.com`
   - Redirect URLs: add `https://justgoblin.com/auth/callback`
   - For dev: add `http://localhost:3000/auth/callback`

2. Auth → Email Templates → **Disable Magic Links**:
   - Auth → Providers → Email → disable "Enable Email Signup" entirely
   - This ensures users can only log in via social providers

3. Auth → Email → Disable OTP / Magic Link if enabled separately

---

## 5. Local Development

Add to `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Add `http://localhost:3000/auth/callback` to your Supabase redirect URLs list.

---

## 6. Testing Checklist

- [ ] Google Sign In redirects to `/auth/callback` and lands on `/dashboard`
- [ ] GitHub Sign In works the same way
- [ ] Apple Sign In works (requires HTTPS — test with Vercel preview URL)
- [ ] Already-logged-in users hitting `/login` redirect to `/dashboard`
- [ ] Logged-out users hitting `/dashboard` redirect to `/login`
- [ ] Sign Out from user menu redirects to `/login` and clears session
- [ ] User row created in `public.users` on first login
