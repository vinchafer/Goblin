import time
# Already on the project chat from prev step; re-open to be deterministic.
new_tab("https://goblin-web.vercel.app/dashboard/chat/dc99ff5c-fdde-4df3-8821-4aeaaf9e0606")
wait_for_load()
cdp("Emulation.setDeviceMetricsOverride", width=390, height=844, deviceScaleFactor=2, mobile=True)
time.sleep(3)
# click the Code tab (role=tab, enabled)
clicked = js("""
(() => {
  const els=[...document.querySelectorAll('[role="tab"]')];
  const code=els.find(e=>/^code$/i.test((e.getAttribute('aria-label')||e.innerText||'').trim()));
  if(code){ code.click(); return 'clicked'; }
  return 'not-found';
})()
""")
print("click:", clicked)
time.sleep(3.5)
print("url-after-code:", js("location.pathname + location.search"))
capture_screenshot(r"C:\Claude Projekte\12 - Goblin\Goblin\sprint-codetab\navfix\d-a1-code-after-click-390.png")

# Now a project-LESS standalone chat: create a fresh top-level chat.
new_tab("https://goblin-web.vercel.app/dashboard/chat")
wait_for_load()
cdp("Emulation.setDeviceMetricsOverride", width=390, height=844, deviceScaleFactor=2, mobile=True)
time.sleep(4)
info = js("""
(() => {
  const res={url:location.pathname, codeControls:[]};
  document.querySelectorAll('[role="tab"]').forEach(el=>{
    const t=(el.getAttribute('aria-label')||el.innerText||'').trim();
    if(/^code$/i.test(t)) res.codeControls.push({disabled: el.disabled===true || el.getAttribute('aria-disabled')==='true', title: el.getAttribute('title')||''});
  });
  return JSON.stringify(res);
})()
""")
print("projectless:", info)
