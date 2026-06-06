import time
new_tab("https://goblin-web.vercel.app/dashboard/project/c7f53841-4478-43cb-a493-e56b170635bf/work?tab=code")
wait_for_load()
time.sleep(3)
r = js("""
(async () => {
  try {
    const keys=Object.keys(localStorage).filter(k=>k.includes('auth-token'));
    let token=null;
    for(const k of keys){ try{const v=JSON.parse(localStorage.getItem(k)); token=v.access_token||(v[0]&&v[0].access_token)||token;}catch(e){} }
    if(!token) return 'no-token';
    const base = 'https://goblinapi-production.up.railway.app';
    const res = await fetch(base + '/api/code-sessions?projectId=c7f53841-4478-43cb-a493-e56b170635bf', {headers:{Authorization:'Bearer '+token}});
    const d = await res.json();
    return JSON.stringify({status:res.status, count:(d.sessions||[]).length, sample:(d.sessions||[]).slice(0,3).map(s=>s.name)});
  } catch(e){ return 'ERR '+e.message; }
})()
""")
print("A4-api:", r)
