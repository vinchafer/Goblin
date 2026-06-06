import time
new_tab("https://goblin-web.vercel.app/dashboard/project/c7f53841-4478-43cb-a493-e56b170635bf")
wait_for_load()
time.sleep(2.5)
print(page_info())
# dump buttons/links text to locate "Neuer Chat" and recent chats
r = js("""
(() => {
  const out={chats:[], buttons:[]};
  document.querySelectorAll('a[href*="/dashboard/chat/"]').forEach(a=>out.chats.push({t:(a.innerText||'').slice(0,40).split(String.fromCharCode(10)).join(' '), h:a.getAttribute('href')}));
  document.querySelectorAll('button').forEach(b=>{const t=(b.innerText||'').trim(); if(t) out.buttons.push(t.slice(0,30));});
  return JSON.stringify(out);
})()
""")
print(r)
capture_screenshot(r"C:\Claude Projekte\12 - Goblin\Goblin\sprint-codetab\navfix\d-project-overview.png")
