import { chromium } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
const env=(k)=>{const t=fs.readFileSync('.env.local','utf8');const m=t.match(new RegExp('^'+k+'=(.*)$','m'));return m?m[1].trim():'';};
const EMAIL=env('TEST_ACCOUNT_EMAIL'),PW=env('TEST_ACCOUNT_PASSWORD'),SUPA=env('NEXT_PUBLIC_SUPABASE_URL'),ANON=env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const BASE='https://www.justgoblin.com';
const PID=process.argv[2]||'82bad455-002a-4cf7-b4fa-b8072cd0b33f';
const ROUND=process.argv[3]||'r1';
const OUT=path.join('sprint-codetab','run-bigfix','shots',ROUND); fs.mkdirSync(OUT,{recursive:true});
async function login(ctx){const p=await ctx.newPage();const res=await p.request.post(`${SUPA}/auth/v1/token?grant_type=password`,{headers:{'Content-Type':'application/json',apikey:ANON},data:{email:EMAIL,password:PW}});const t=await res.json();const hash=`#access_token=${t.access_token}&refresh_token=${t.refresh_token}&expires_in=3600&token_type=bearer&type=magiclink`;await p.goto(`${BASE}/auth/magic-callback${hash}`,{waitUntil:'domcontentloaded'});await p.waitForURL(/\/dashboard/,{timeout:30000}).catch(()=>{});return p;}
const errs={};
function attach(p,k){errs[k]=[];p.on('pageerror',e=>errs[k].push('PAGEERR:'+(e.message||'').slice(0,120)));p.on('console',m=>{if(m.type()==='error'&&!/429/.test(m.text()))errs[k].push('CON:'+m.text().slice(0,120));});}
async function cap(p,k,url){attach(p,k);await p.goto(url,{waitUntil:'domcontentloaded',timeout:35000}).catch(()=>{});await p.waitForTimeout(3500);await p.screenshot({path:path.join(OUT,k+'.png')});const txt=await p.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').slice(0,400)).catch(()=>'');console.log(k,'| errs:',(errs[k]||[]).length,'|',txt.slice(0,140));}
const b=await chromium.launch({headless:true});
// mobile
const mctx=await b.newContext({viewport:{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}});
const mp=await login(mctx);
await cap(mp,'m-proj-overview',`${BASE}/dashboard/project/${PID}`);
await cap(mp,'m-proj-code',`${BASE}/dashboard/project/${PID}/work?tab=code`);
await cap(mp,'m-proj-files',`${BASE}/dashboard/project/${PID}/files`);
// desktop (WS-B columns)
const dctx=await b.newContext({viewport:{width:1366,height:900}});
const dp=await login(dctx);
await cap(dp,'d-proj-files',`${BASE}/dashboard/project/${PID}/files`);
await cap(dp,'d-proj-code',`${BASE}/dashboard/project/${PID}/work?tab=code`);
await cap(dp,'d-dashboard',`${BASE}/dashboard`);
fs.writeFileSync(path.join(OUT,'_proj-errs.json'),JSON.stringify(errs,null,2));
await b.close(); console.log('DONE',OUT);
