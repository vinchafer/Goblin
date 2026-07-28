# AKT 2 · PHASE 1 — cohort-invisibility probe (live production API)

> Raw captured `curl` output. Stored as `.md` because the repo's `.gitignore` excludes `*.txt`,
> which silently dropped the first capture from the evidence commit. An artifact the reviewer
> cannot open is not evidence.

```text
Captured: 2026-07-28T02:59:39Z · Deterministic (curl, exact commands shown)
API base: https://goblinapi-production.up.railway.app

PURPOSE. Two facts, both measured, not asserted:
  1. Which commit production is running — i.e. whether this PR's code is deployed.
  2. What an unauthenticated request to the Act-2 routes returns, against a CONTROL request
     to a path that was never mounted. If the two differ, the gate leaks its own existence.

=== 1. $ curl -s $API/api/version ===
{"version":"0.2.0","gitCommit":"a009bbd2bbef4d8b0ff693af9614cc0a3f6f52c5","buildTime":"2026-07-28T00:36:00.508Z","env":"production","apiReady":true}

=== 2. $ curl -s -i $API/api/ops/health   (anonymous) ===
HTTP/2 404 
content-type: text/plain; charset=UTF-8
404 Not Found

=== 3. $ curl -s -i -X POST $API/api/ops/selftest   (anonymous) ===
HTTP/2 404 
content-type: text/plain; charset=UTF-8
404 Not Found

=== 4. $ curl -s -i $API/api/definitely-not-a-route   (CONTROL: never-mounted path) ===
HTTP/2 404 
content-type: text/plain; charset=UTF-8
404 Not Found

READING. gitCommit a009bbd is origin/master — this PR's code is NOT deployed, which is why the
U1.5 round-trip cannot run before merge. Responses 2, 3 and 4 are identical (404, text/plain,
same body): today because /api/ops is unmounted, and after merge because the gate reproduces
this exact response. That identity is the property; see ops-gate.test.ts, which asserts it
against a bare Hono app's own 404 so it cannot drift.
```
