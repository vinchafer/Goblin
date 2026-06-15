import { chromium } from '@playwright/test';
import fs from 'node:fs';
const env=(k)=>{const t=fs.readFileSync('.env.local','utf8');const m=t.match(new RegExp('^'+k+'=(.*)$','m'));return m?m[1].trim():'';};
const EMAIL=env('TEST_ACCOUNT_EMAIL'),PW=env('TEST_ACCOUNT_PASSWORD'),SUPA=env('NEXT_PUBLIC_SUPABASE_URL'),ANON=env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const BASE='https://www.justgoblin.com';
const b=await chromium.launch({headless:true});
const ctx=await b.newContext({viewport:{width:390,height:844,isMobile:true}});
const p=await ctx.newPage();
const reqs=[];
p.on('response',r=>{const u=r.url();if(/railway|justgoblin/.test(u)&&!/_next|_rsc|favicon/.test(u)){if(r.status()===429||r.status()>=400)reqs.push(r.status()+' '+u.slice(0,90));}});
const res=await p.request.post(`${SUPA}/auth/v1/token?grant_type=password`,{headers:{'Content-Type':'application/json',apikey:ANON},data:{email:EMAIL,password:PW}});
const t=await res.json();
const hash=`#access_token=${t.access_token}&refresh_token=${t.refresh_token}&expires_in=3600&token_type=bearer&type=magiclink`;
await p.goto(`${BASE}/auth/magic-callback${hash}`,{waitUntil:'domcontentloaded'});
await p.waitForURL(/\/dashboard/,{timeout:30000}).catch(()=>{});
await p.waitForTimeout(3000); // let dashboard settle
reqs.length=0; // clear dashboard load
console.log('--- navigating to #connectors fresh ---');
await p.goto(`${BASE}/dashboard#connectors`,{waitUntil:'domcontentloaded'});
await p.waitForTimeout(5000);
console.log('4xx/429 requests after opening #connectors:',reqs.length);
reqs.slice(0,20).forEach(r=>console.log('  '+r));
await b.close();
