import { chromium } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
const env=(k)=>{const t=fs.readFileSync('.env.local','utf8');const m=t.match(new RegExp('^'+k+'=(.*)$','m'));return m?m[1].trim():'';};
const EMAIL=env('TEST_ACCOUNT_EMAIL'),PW=env('TEST_ACCOUNT_PASSWORD'),SUPA=env('NEXT_PUBLIC_SUPABASE_URL'),ANON=env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const BASE='https://www.justgoblin.com';
const OUT=path.join('sprint-codetab','run-bigfix','shots','r2'); fs.mkdirSync(OUT,{recursive:true});
const errs={};
async function login(ctx){const p=await ctx.newPage();const res=await p.request.post(`${SUPA}/auth/v1/token?grant_type=password`,{headers:{'Content-Type':'application/json',apikey:ANON},data:{email:EMAIL,password:PW}});const t=await res.json();const hash=`#access_token=${t.access_token}&refresh_token=${t.refresh_token}&expires_in=3600&token_type=bearer&type=magiclink`;await p.goto(`${BASE}/auth/magic-callback${hash}`,{waitUntil:'domcontentloaded'});await p.waitForURL(/\/dashboard/,{timeout:30000}).catch(()=>{});return p;}
function attach(p,k){errs[k]=[];p.on('pageerror',e=>errs[k].push('PAGEERR:'+(e.message||'').slice(0,140)));}
async function cap(p,k,url,waitMs=4000){attach(p,k);await p.goto(url,{waitUntil:'domcontentloaded',timeout:35000}).catch(()=>{});await p.waitForTimeout(waitMs);await p.screenshot({path:path.join(OUT,k+'.png')});const has418=(errs[k]||[]).some(e=>e.includes('418'));console.log(k,has418?'⚠️#418':'ok#418-clean',(errs[k]||[]).length?'errs='+errs[k].length:'');}
const b=await chromium.launch({headless:true});
const ctx=await b.newContext({viewport:{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}});
const p=await login(ctx);
await cap(p,'dashboard',`${BASE}/dashboard`,5000);
await p.waitForTimeout(2500);
await cap(p,'help',`${BASE}/help`);
await p.waitForTimeout(2500);
await cap(p,'about',`${BASE}/about`);
await p.waitForTimeout(2500);
await cap(p,'settings-profile',`${BASE}/dashboard#profile`,5000);
fs.writeFileSync(path.join(OUT,'_errs.json'),JSON.stringify(errs,null,2));
await b.close(); console.log('DONE');
