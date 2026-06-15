import fs from 'node:fs';
const env=(k)=>{const t=fs.readFileSync('.env.local','utf8');const m=t.match(new RegExp('^'+k+'=(.*)$','m'));return m?m[1].trim():'';};
const SUPA=env('NEXT_PUBLIC_SUPABASE_URL'),ANON=env('NEXT_PUBLIC_SUPABASE_ANON_KEY'),EMAIL=env('TEST_ACCOUNT_EMAIL'),PW=env('TEST_ACCOUNT_PASSWORD');
const API='https://goblinapi-production.up.railway.app';
const PID='82bad455-002a-4cf7-b4fa-b8072cd0b33f';
const tok=await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`,{method:'POST',headers:{'Content-Type':'application/json',apikey:ANON},body:JSON.stringify({email:EMAIL,password:PW})})).json();
const at=tok.access_token;
// Safe: move to SAME project → server returns 400 "identisch" if deployed. No mutation.
const r=await fetch(`${API}/api/projects/${PID}/files/move-to-project`,{method:'POST',headers:{Authorization:`Bearer ${at}`,'Content-Type':'application/json'},body:JSON.stringify({path:'index.html',toProjectId:PID})});
console.log('move-to-project (same proj) →',r.status, (await r.text()).slice(0,150));
