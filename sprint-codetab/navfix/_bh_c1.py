import time
new_tab("https://goblin-web.vercel.app/dashboard/chat/dc99ff5c-fdde-4df3-8821-4aeaaf9e0606")
wait_for_load()
cdp("Emulation.setDeviceMetricsOverride", width=390, height=844, deviceScaleFactor=2, mobile=True)
time.sleep(3)
# locate the code-action button (aria-label "Code-Aktionen")
loc = js("""
(() => {
  const b=[...document.querySelectorAll('button')].find(x=>/Code-Aktionen/i.test(x.getAttribute('aria-label')||x.getAttribute('title')||''));
  if(!b) return 'no-btn';
  const r=b.getBoundingClientRect();
  return JSON.stringify({x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)});
})()
""")
print("codeaction:", loc)
capture_screenshot(r"C:\Claude Projekte\12 - Goblin\Goblin\sprint-codetab\navfix\c-chat-before-stc.png")
