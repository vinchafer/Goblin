// Phase-3 R1 probe: does Send-to-Code's persistence path write a deployable file
// that listFiles returns? Hits the same (prod Railway) API the web app uses, as the
// test user. Creates test-stc-{ts}, PUTs index.html (the smart-detected name),
// GETs files immediately + after a delay (S3 race check), then DELETEs. Read-light, cleans up.
import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd();
const env = k => { const m = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
const EMAIL = env('TEST_ACCOUNT_EMAIL'), PW = env('TEST_ACCOUNT_PASSWORD'), SUPA = env('NEXT_PUBLIC_SUPABASE_URL'), ANON = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const API = "http://localhost:3001";
const HTML = `<!DOCTYPE html>\n<html lang="de"><head><meta charset="utf-8"><title>Goblin STC</title></head>\n<body><h1>Hello from Goblin</h1><a href="#">CTA</a></body></html>`;
const out = { api: API, steps: [] };
const log = (k, v) => { out.steps.push({ [k]: v }); console.log(k, typeof v === 'string' ? v : JSON.stringify(v)); };
(async () => {
  // 1. token
  const tr = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PW }) });
  const td = await tr.json(); const TOK = td.access_token;
  log('auth', tr.status);
  const H = { Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json' };
  // 2. create project
  const name = `test-stc-${Date.now()}`;
  const cr = await fetch(`${API}/api/projects`, { method: 'POST', headers: H, body: JSON.stringify({ name }) });
  const cd = await cr.json().catch(() => ({}));
  const pid = cd.id || cd.project?.id || cd.projectId;
  log('createProject', { status: cr.status, pid, name });
  if (!pid) { log('FATAL', 'no project id'); fs.writeFileSync(path.join(ROOT,'sprint-5','stc-flow','persist-probe.json'), JSON.stringify(out,null,2)); return; }
  // 3. files BEFORE (expect 0)
  let fr = await fetch(`${API}/api/projects/${pid}/files`, { headers: H }); let fd = await fr.json().catch(()=>({}));
  log('filesBefore', fd.files || fd);
  // 4. PUT index.html (the Send-to-Code Apply persistence call)
  const pr = await fetch(`${API}/api/projects/${pid}/files/index.html`, { method: 'PUT', headers: H, body: JSON.stringify({ content: HTML }) });
  log('putIndexHtml', { status: pr.status, body: await pr.json().catch(()=>'') });
  // 5. files IMMEDIATELY after (race check)
  fr = await fetch(`${API}/api/projects/${pid}/files`, { headers: H }); fd = await fr.json().catch(()=>({}));
  log('filesImmediate', fd.files || fd);
  // 6. files after 2.5s (eventual consistency)
  await new Promise(r => setTimeout(r, 2500));
  fr = await fetch(`${API}/api/projects/${pid}/files`, { headers: H }); fd = await fr.json().catch(()=>({}));
  log('filesAfterDelay', fd.files || fd);
  // 7. read back content
  const gr = await fetch(`${API}/api/projects/${pid}/files/index.html`, { headers: H }); const gd = await gr.json().catch(()=>({}));
  log('readBack', { status: gr.status, len: (gd.content||'').length, head: (gd.content||'').slice(0,40) });
  // 8. cleanup
  const dr = await fetch(`${API}/api/projects/${pid}`, { method: 'DELETE', headers: H });
  log('cleanup', dr.status);
  fs.writeFileSync(path.join(ROOT,'sprint-5','stc-flow','persist-probe.json'), JSON.stringify(out,null,2));
  console.log('PROBE_DONE');
})().catch(e => { console.log('PROBE_FATAL', e.message); });
