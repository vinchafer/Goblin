// READ-ONLY probe via raw REST: does the test user have a Vercel BYOK token? (B1 feasibility)
import { readFileSync } from 'node:fs';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8').replace(/^﻿/, '');
const env = {};
for (const raw of envText.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq < 1) continue;
  env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}
console.log('parsed env keys:', Object.keys(env).length);
const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/$/, '');
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const email = env.TEST_ACCOUNT_EMAIL;
const H = { apikey: key, Authorization: `Bearer ${key}` };

// 1. find test user id via GoTrue admin
const ur = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers: H });
const uj = await ur.json();
const list = uj.users ?? uj;
const u = list.find((x) => x.email?.toLowerCase() === email?.toLowerCase());
console.log('test user:', email, '→ id:', u?.id ?? 'NOT FOUND');
if (!u) process.exit(0);

// 2. byok_keys for that user (PostgREST)
const kr = await fetch(`${url}/rest/v1/byok_keys?user_id=eq.${u.id}&select=provider,status,created_at`, { headers: H });
const keys = await kr.json();
console.log('byok_keys:', JSON.stringify(keys, null, 2));
const vercel = Array.isArray(keys) ? keys.filter((k) => k.provider === 'vercel') : [];
console.log('VERCEL TOKENS:', vercel.length, vercel.length ? '(active: ' + vercel.filter((v) => v.status === 'active').length + ')' : '');

// 3. project count (head + Prefer count)
const pr = await fetch(`${url}/rest/v1/projects?user_id=eq.${u.id}&select=id`, {
  headers: { ...H, Prefer: 'count=exact', Range: '0-0' },
});
console.log('test user project count header:', pr.headers.get('content-range'));
