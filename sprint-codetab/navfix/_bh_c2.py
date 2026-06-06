import time
# (continues on same tab/session)
click_at_xy(356, 692)
time.sleep(1.2)
# find "Send to Code" item
sttc = js("""
(() => {
  const el=[...document.querySelectorAll('button')].find(x=>/send to code/i.test(x.innerText||''));
  if(!el) return 'no-item';
  const r=el.getBoundingClientRect();
  return JSON.stringify({x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)});
})()
""")
print("sendtocode-item:", sttc)
capture_screenshot(r"C:\Claude Projekte\12 - Goblin\Goblin\sprint-codetab\navfix\c-dropdown.png")
