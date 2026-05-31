// READ-ONLY: verify new test-account Vercel token + list existing projects (find placeholder)
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
const token = env.VERCEL_TOKEN_SCOPE;
console.log('token prefix:', token ? token.slice(0, 8) + '…' : 'MISSING');
const H = { Authorization: `Bearer ${token}` };

// who am I
const ur = await fetch('https://api.vercel.com/v2/user', { headers: H });
console.log('GET /v2/user →', ur.status);
if (ur.ok) {
  const u = await ur.json();
  console.log('  user:', u.user?.username ?? u.username, '| email:', u.user?.email ?? u.email);
}

// list projects
const pr = await fetch('https://api.vercel.com/v9/projects?limit=100', { headers: H });
console.log('GET /v9/projects →', pr.status);
if (pr.ok) {
  const pj = await pr.json();
  const names = (pj.projects ?? []).map((p) => p.name);
  console.log('  project count:', names.length);
  console.log('  projects:', JSON.stringify(names));
} else {
  console.log('  body:', (await pr.text()).slice(0, 300));
}

// list teams (token may be team-scoped)
const tr = await fetch('https://api.vercel.com/v2/teams', { headers: H });
if (tr.ok) {
  const tj = await tr.json();
  console.log('  teams:', JSON.stringify((tj.teams ?? []).map((t) => ({ id: t.id, slug: t.slug }))));
}
