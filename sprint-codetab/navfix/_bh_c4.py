import time
click_at_xy(256, 801)   # Alle senden
time.sleep(6)           # navigate + create session + load detail
state = js("""
(() => {
  const res={url:location.pathname+location.search};
  // session chip name (mobile)
  const chip=[...document.querySelectorAll('button')].map(b=>(b.innerText||'').trim()).filter(Boolean);
  res.chip = chip.slice(0,14);
  // active file name shown in the file bar (JetBrains mono span) + draft badge text
  const fileBar=[...document.querySelectorAll('span')].map(s=>(s.innerText||'').trim()).filter(t=>/\.(html|css|js|tsx?)$/.test(t));
  res.fileNames = [...new Set(fileBar)].slice(0,8);
  res.hasEntwurf = /Entwurf/.test(document.body.innerText);
  return JSON.stringify(res);
})()
""")
print("after-stc:", state)
capture_screenshot(r"C:\Claude Projekte\12 - Goblin\Goblin\sprint-codetab\navfix\c-after-stc-codetab.png")
