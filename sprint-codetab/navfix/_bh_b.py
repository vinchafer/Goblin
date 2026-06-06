import time
new_tab("https://goblin-web.vercel.app/dashboard/project/c7f53841-4478-43cb-a493-e56b170635bf/work?tab=code")
wait_for_load()
cdp("Emulation.setDeviceMetricsOverride", width=390, height=844, deviceScaleFactor=2, mobile=True)
time.sleep(4)
# state BEFORE opening
before = js("""
(() => {
  const a=document.querySelector('[data-testid="mobile-sidebar"]');
  if(!a) return 'no-aside';
  const cs=getComputedStyle(a); const r=a.getBoundingClientRect();
  return JSON.stringify({transform:cs.transform, zIndex:cs.zIndex, left:Math.round(r.left), width:Math.round(r.width)});
})()
""")
print("before:", before)
capture_screenshot(r"C:\Claude Projekte\12 - Goblin\Goblin\sprint-codetab\navfix\b-before-hamburger.png")
# click hamburger top-left
click_at_xy(34, 28)
time.sleep(1.5)
after = js("""
(() => {
  const a=document.querySelector('[data-testid="mobile-sidebar"]');
  if(!a) return 'no-aside';
  const cs=getComputedStyle(a); const r=a.getBoundingClientRect();
  // is the topmost element at a point inside the sidebar the sidebar (or its child)?
  const cx=Math.round(r.left+r.width/2), cy=200;
  const top=document.elementFromPoint(cx,cy);
  const inside = a.contains(top);
  return JSON.stringify({transform:cs.transform, zIndex:cs.zIndex, left:Math.round(r.left), width:Math.round(r.width), topAtCenterInsideSidebar:inside, topTag:top?top.tagName:null});
})()
""")
print("after:", after)
capture_screenshot(r"C:\Claude Projekte\12 - Goblin\Goblin\sprint-codetab\navfix\b-after-hamburger.png")
