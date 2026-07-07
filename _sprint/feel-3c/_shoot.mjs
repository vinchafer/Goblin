import { chromium } from '@playwright/test';
import { pathToFileURL } from 'url';
const url = pathToFileURL(process.cwd() + '/_sprint/feel-3c/c_states.html').href;
const b = await chromium.launch();
for (const theme of ['light','dark']) {
  for (const [w,tag] of [[375,'375'],[1440,'1440']]) {
    const p = await b.newPage({ viewport:{ width:w, height:900 }, deviceScaleFactor:2 });
    await p.goto(url);
    await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
    await p.waitForTimeout(200);
    await p.screenshot({ path:`_sprint/feel-3c/shots/c_states_${theme}_${tag}.png`, fullPage:true });
    await p.close();
    console.log('shot', theme, tag);
  }
}
await b.close();
