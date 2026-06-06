r = js("""
(() => {
  const out=[];
  document.querySelectorAll('a[href*="/dashboard/chat/"]').forEach(a=>{
    out.push({t:(a.innerText||'').slice(0,46).split(String.fromCharCode(10)).join(' '), h:a.getAttribute('href')});
  });
  return JSON.stringify(out);
})()
""")
print(r)
