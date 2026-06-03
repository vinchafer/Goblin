# Standing rules for Goblin sessions

## Chrome + CDP debug port
Every session, FIRST action after Phase 0 environment checks: verify
`localhost:9222` reachable, launch Chrome if not. Launching is Claude Code's
responsibility, not the founder's — do it without asking.

Check:
```
curl -s http://localhost:9222/json/version
```
If no JSON, launch (Windows):
```
"C:\Program Files\Google\Chrome\Application\chrome.exe" \
  --remote-debugging-port=9222 \
  --user-data-dir="C:\Claude Projekte\12 - Goblin\Goblin\.chrome-debug-profile"
```
(Fallback path: `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`.)
Launch in the background, wait 3–5s, re-verify the JSON.

Chrome stays open between sessions — don't kill it. Never write "CDP deferred"
as a default; only after an actual launch attempt failed, with the reason logged
to `sprint-XX/CHROME_LAUNCH_INCIDENT.md`, then stop and ask.

## Push at end of sprint
If commits are local at the end of a sprint, push them (`git push origin
master`) BEFORE writing the COMPLETE report. The founder cannot validate or
walk what isn't deployed. Never force-push; on rejection, fetch + rebase
carefully or stop and ask. Healthcheck web + API after the push.

## Founder is not your fallback
If a tool is missing, find an alternative or install/configure it yourself.
Only stop-and-ask when:
- It needs the founder's secret/credential
- It needs production-shield permission
- It would change founder accounts (Vercel, GitHub, Supabase, etc.)
Everything else: solve it.
