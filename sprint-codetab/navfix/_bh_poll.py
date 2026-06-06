import time
new_tab("https://goblin-web.vercel.app/dashboard/project/c7f53841-4478-43cb-a493-e56b170635bf/work?tab=code")
wait_for_load()
cdp("Emulation.setDeviceMetricsOverride", width=390, height=844, deviceScaleFactor=2, mobile=True)
time.sleep(5)
surf = js("(()=>{const s=document.querySelector('.gb-surface-col');return s?getComputedStyle(s).display:'none-el';})()")
print("SURF:", surf)
