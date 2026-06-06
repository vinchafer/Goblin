import time
new_tab("https://goblin-web.vercel.app/dashboard/project/c7f53841-4478-43cb-a493-e56b170635bf/work?tab=code")
wait_for_load()
cdp("Emulation.setDeviceMetricsOverride", width=390, height=844, deviceScaleFactor=2, mobile=True)
time.sleep(5)
state = js("""
(() => {
  const res={};
  // docked ask bar (A.2)
  const ask=document.querySelector('.gb-editor-ask');
  res.askBarExists = !!ask;
  if(ask){ const cs=getComputedStyle(ask); res.askBarDisplay=cs.display; const inp=ask.querySelector('input'); res.askPlaceholder=inp?inp.placeholder:null; }
  // surface column visible? (editor view) vs thread
  const surf=document.querySelector('.gb-surface-col');
  if(surf){ res.surfaceDisplay=getComputedStyle(surf).display; }
  const thread=document.querySelector('.gb-thread-col');
  if(thread){ res.threadDisplay=getComputedStyle(thread).display; }
  // active file name + draft badge
  const chip=[...document.querySelectorAll('span')].map(s=>(s.innerText||'').trim()).find(t=>/index/.test(t)&&t.length<30);
  res.activeName=chip||null;
  res.hasEntwurf=/Entwurf/.test(document.body.innerText);
  return JSON.stringify(res);
})()
""")
print("A2/C3:", state)
capture_screenshot(r"C:\Claude Projekte\12 - Goblin\Goblin\sprint-codetab\navfix\d-a2-editor-askbar-390.png")
