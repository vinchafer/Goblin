import time
new_tab("https://goblin-web.vercel.app/dashboard/chat/dc99ff5c-fdde-4df3-8821-4aeaaf9e0606")
wait_for_load()
cdp("Emulation.setDeviceMetricsOverride", width=390, height=844, deviceScaleFactor=2, mobile=True)
time.sleep(3)
info = js("""
(() => {
  const res={codeControls:[]};
  document.querySelectorAll('[role="tab"],[role="menuitem"],button').forEach(el=>{
    const t=(el.getAttribute('aria-label')||el.innerText||'').trim();
    if(/^code$/i.test(t)){
      res.codeControls.push({role:el.getAttribute('role'), disabled: el.disabled===true || el.getAttribute('aria-disabled')==='true', title: el.getAttribute('title')||''});
    }
  });
  return JSON.stringify(res);
})()
""")
print("A1:", info)
capture_screenshot(r"C:\Claude Projekte\12 - Goblin\Goblin\sprint-codetab\navfix\d-a1-projectchat-390.png")
