// Phase-1 typography diagnosis: capture settings modal (desktop) + SettingsRoot (mobile).
import { chromium } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.cwd();
const OUT = path.join(ROOT, 'sprint-5', 'typography'); fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3000';
const env = k => { const m = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : ''; };
const EMAIL = env('TEST_ACCOUNT_EMAIL'), PW = env('TEST_ACCOUNT_PASSWORD'), SUPA = env('NEXT_PUBLIC_SUPABASE_URL'), ANON = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const log = {};
(async()=>{
  const b=await chromium.launch({headless:true});
  const ctx=await b.newContext({viewport:{width:1280,height:860}});
  const page=await ctx.newPage();
  const r=await page.request.post(`${SUPA}/auth/v1/token?grant_type=password`,{headers:{apikey:ANON,'Content-Type':'application/json'},data:{email:EMAIL,password:PW}});
  const d=await r.json();
  await page.goto(`${BASE}/auth/magic-callback#access_token=${d.access_token}&refresh_token=${d.refresh_token}&expires_in=${d.expires_in||3600}&token_type=bearer&type=magiclink`,{waitUntil:'domcontentloaded'});
  await page.waitForURL(/\/dashboard/,{timeout:20000}).catch(()=>{});
  await page.waitForTimeout(1500);
  // Desktop: open settings modal. Try direct settings sub-route first (renders standalone), then modal trigger.
  await page.goto(BASE+'/dashboard/settings/notifications',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1500);
  log.subpageUrl=page.url();
  await page.screenshot({path:path.join(OUT,'settings-subpage-desktop.png'),fullPage:false});
  // Try opening the settings modal via avatar menu -> Einstellungen
  await page.goto(BASE+'/dashboard',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(1200);
  let opened=false;
  try {
    // avatar button top-right
    const av = await page.$('header button:last-of-type, [aria-label*="Konto" i], [aria-label*="account" i], [aria-label*="avatar" i]');
    if(av){ await av.click(); await page.waitForTimeout(600);
      const item = await page.$('text=/Einstellungen|Settings/i');
      if(item){ await item.click(); await page.waitForTimeout(1200); opened=true; }
    }
  } catch(e){ log.modalErr=e.message; }
  log.modalOpened=opened; log.afterModalUrl=page.url();
  await page.screenshot({path:path.join(OUT,'settings-modal-desktop.png'),fullPage:false});
  // Mobile SettingsRoot
  const m=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
  const mp=await m.newPage();
  await mp.goto(`${BASE}/auth/magic-callback#access_token=${d.access_token}&refresh_token=${d.refresh_token}&expires_in=${d.expires_in||3600}&token_type=bearer&type=magiclink`,{waitUntil:'domcontentloaded'});
  await mp.waitForURL(/\/dashboard/,{timeout:20000}).catch(()=>{});
  await mp.waitForTimeout(1200);
  await mp.goto(BASE+'/dashboard/settings/notifications',{waitUntil:'domcontentloaded'}); await mp.waitForTimeout(1500);
  await mp.screenshot({path:path.join(OUT,'settings-subpage-mobile.png'),fullPage:false});
  await mp.goto(BASE+'/dashboard',{waitUntil:'domcontentloaded'}); await mp.waitForTimeout(1200);
  await mp.screenshot({path:path.join(OUT,'dashboard-mobile.png'),fullPage:false});
  fs.writeFileSync(path.join(OUT,'settings-shot.json'),JSON.stringify(log,null,2));
  console.log('SHOT_DONE '+JSON.stringify(log));
  await b.close();
})().catch(e=>{console.log('SHOT_FATAL '+(e&&e.message));});
