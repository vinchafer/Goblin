# P1.10 — Dashboard glitches: diagnosis + fix

## (a) "Projekte konnten nicht geladen werden — erneut versuchen"

**Diagnosis.** The dashboard's `loadProjects` (`app/dashboard/page.tsx`) fires
`Promise.all([ fetch('/api/projects'), fetch('/api/users/me') ])` with **no retry**.
On mount the dashboard is not the only caller — the sidebar usage widget
(`/api/users/me/usage`, `/api/users/me`), the connectors/status probes, trial
banners, etc. all hit `/api/*` at roughly the same moment. The API guards `/api/*`
with `generalRateLimit` — **60 requests/min** (`apps/api/src/index.ts`; note
`strictRateLimit` is *defined but never applied*, so the earlier "10/min"
attribution was wrong — same as the P1.7 finding). Under a burst (a fast reload,
or a heavier account) one of those requests comes back **429**, and because
`loadProjects` had no tolerance it immediately threw
`'Projekte konnten nicht geladen werden'` → the founder's error card + "erneut
versuchen". It's transient: the manual retry almost always succeeds because by
then the 1-minute window has room again.

**Fix.** Added `fetchWithRetryOn429` to `lib/api.ts` (bounded retry: 3 attempts,
exponential backoff + jitter, honoring `Retry-After`) and routed both dashboard
mount requests through it. A transient 429 is now absorbed silently; the error
card only appears on a genuine, sustained failure. Same philosophy as the P1.7
badge-base loader.

## (b) Sidebar "Kontingent 0 %"

**Diagnosis.** `SidebarUsage` renders `Kontingent  {pct} %`, where
`pct = goblinCap.percent` = **percent consumed** (the same number and semantics
as the full usage page's `GoblinUsageBar`, whose caption is "X% used"). But
"Kontingent 0 %" is ambiguous — a reader can't tell whether it means "0 % of the
quota is left" (alarming) or "0 % used" (reassuring, which is the truth). Nothing
in the label disambiguated it.

**Fix.** The percent now reads **"{pct} % verbraucht"** (EN "used"), matching the
usage-page semantics, so "0 % verbraucht" plainly means nothing has been consumed
yet. No change to the underlying number, the progressbar aria, or the reset copy.
