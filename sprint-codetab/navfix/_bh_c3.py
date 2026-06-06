import time
click_at_xy(283, 549)   # Send to Code -> opens preview sheet
time.sleep(1.8)
capture_screenshot(r"C:\Claude Projekte\12 - Goblin\Goblin\sprint-codetab\navfix\c-preview-sheet.png")
# find a confirm button in the sheet
btns = js("""
(() => {
  const out=[];
  document.querySelectorAll('button').forEach(b=>{const t=(b.innerText||'').trim(); if(t){const r=b.getBoundingClientRect(); if(r.width>0) out.push({t:t.slice(0,28), x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)});}});
  return JSON.stringify(out);
})()
""")
print("sheet-buttons:", btns)
