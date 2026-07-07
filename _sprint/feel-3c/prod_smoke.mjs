// FEEL-3c prod smoke — a REAL agent run against deployed prod (b2150a1), SSE-direct.
// Proves the deployed agent loop runs end-to-end with real step timing gaps (the idle
// gaps a C3 quote renders into) and emits a polished C4 report card. No publish intent
// → lands as a saved draft (no real Vercel deploy side effect).

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = process.env.TEST_ACCOUNT_EMAIL;
const API = 'https://goblinapi-production.up.railway.app';

const admin = (path, body, method = 'POST') =>
  fetch(`${URL}${path}`, { method, headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
const j = async (label, p) => { const r = await p; const txt = await r.text(); if (!r.ok) throw new Error(`${label} HTTP ${r.status}: ${txt.slice(0,200)}`); try { return txt ? JSON.parse(txt) : null; } catch { throw new Error(`${label} bad JSON: ${txt.slice(0,120)}`); } };

async function main() {
  // 1) test user id
  const ul = await j('users', admin(`/auth/v1/admin/users?per_page=200`, null, 'GET'));
  const user = (ul.users || []).find((u) => (u.email || '').toLowerCase() === EMAIL.toLowerCase());
  if (!user) throw new Error('test user not found');
  const userId = user.id;

  // 2) a project owned by the test user (reuse newest, else create)
  const pj = await j('projects.get', admin(`/rest/v1/projects?user_id=eq.${userId}&select=id,name&order=created_at.desc&limit=1`, null, 'GET'));
  let projectId = pj[0]?.id;
  if (!projectId) {
    const c = await j('projects.ins', admin(`/rest/v1/projects`, { user_id: userId, name: 'feel3c-smoke' }));
    projectId = c[0]?.id;
  }

  // 3) a Forge code session
  const cs = await j('cs.ins', admin(`/rest/v1/code_sessions`, { project_id: projectId, user_id: userId, name: 'feel3c-smoke', model_id: 'goblin/premium' }));
  const sessionId = cs[0]?.id;
  if (!sessionId) throw new Error('code session insert failed: ' + JSON.stringify(cs));

  // 4) mint an access token (admin magiclink → verify)
  const gl = await j('genlink', admin(`/auth/v1/admin/generate_link`, { type: 'magiclink', email: EMAIL }));
  const hashed = gl.hashed_token || gl.properties?.hashed_token;
  const vr = await j('verify', fetch(`${URL}/auth/v1/verify`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: hashed }) }));
  const token = vr.access_token;
  if (!token) throw new Error('token mint failed: ' + JSON.stringify(vr));

  console.log(JSON.stringify({ userId, projectId, sessionId, tokenLen: token.length }));

  // 5) run the agent (no publish intent → saved draft). Stream SSE, timestamp events.
  const t0 = Date.now();
  const res = await fetch(`${API}/api/code-sessions/${sessionId}/agent`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ prompt: 'Baue eine schöne kleine Landing-Page (index.html) für ein Café namens „Waldkante" mit Überschrift, kurzem Text und einem Button. Sichere den Entwurf.', modelId: 'goblin/premium' }),
  });
  if (!res.ok) throw new Error(`agent HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const events = [];
  let lastStepAt = t0;
  let maxGap = 0;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, idx); buf = buf.slice(idx + 2);
      const line = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      let d; try { d = JSON.parse(line.slice(5).trim()); } catch { continue; }
      const at = Date.now() - t0;
      if (d.type === 'agent_step') { const gap = (Date.now() - lastStepAt); if (gap > maxGap) maxGap = gap; lastStepAt = Date.now(); events.push({ at, type: 'step', tool: d.tool, ok: d.ok, ms: d.ms, summary: d.summary }); }
      else if (d.type === 'agent_narration') events.push({ at, type: 'narration', text: (d.text || '').slice(0, 80) });
      else if (d.type === 'agent_report') events.push({ at, type: 'report', state: d.report?.state, outcome: d.report?.outcome, files: d.report?.files?.length, units: d.report?.unitsConsumed, followUps: d.report?.followUps });
      else events.push({ at, type: d.type });
    }
  }
  console.log(JSON.stringify({ maxStepGapMs: maxGap, quoteWouldShow: maxGap > 4000, events }, null, 2));
}
main().catch((e) => { console.error('SMOKE_FAIL', e.message); process.exit(1); });
