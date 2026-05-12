# PERFORMANCE_AUDIT.md — Session 4

**Scope:** Client-side performance review via code audit.
**Note:** Backend streaming latency (first-token time) depends on provider response times and is outside frontend scope.

---

## Already Optimized (no changes needed)

| Area | Status |
|------|--------|
| CodeEditor (CodeMirror 6) | Lazy-loaded via `dynamic()` with `ssr: false` |
| PreviewTab | Lazy-loaded via `dynamic()` |
| `prefers-reduced-motion` | Implemented in globals.css (all animations disabled for motion-sensitive users) |
| Skeleton loading class | `.skeleton` with shimmer animation in globals.css |
| API rewrite via Next.js | Rewrites to Railway backend, no extra hop |
| Dashboard project list | Skeleton placeholders during load |
| Chat history | GoblinLoader (contextual variant) during load |

---

## Improvements Made (Session 4)

### 1. `FirstRunTour` → lazy-loaded
**File:** `components/app-shell/dashboard-shell.tsx`
**Before:** Synchronous import, always in bundle even for returning users
**After:** `dynamic()` with `ssr: false` — only loads if user needs onboarding tour

### 2. Better root `loading.tsx`
**File:** `app/loading.tsx`
**Before:** Tailwind spinner (`animate-spin`) — jarring, no brand identity
**After:** Goblin icon with ochre progress bar — brand-consistent, smoother feeling

### 3. Dashboard skeleton `loading.tsx`
**File:** `app/dashboard/loading.tsx` (new)
**Before:** No dashboard-specific loading state — flash of empty content
**After:** Full skeleton layout matching the actual dashboard structure (project list + updates panel)

---

## Remaining Performance Considerations

### Streaming First-Token Time
**Current:** Unknown (not measurable via code audit)
**Target:** <2s after message send
**Action:** Monitor via Sentry + backend logs. Frontend starts rendering immediately on first `delta` event (streaming architecture is correct).

### `checkModels()` API calls
**File:** `components/workspace/chat-tab.tsx`
**Issue:** Calls `/api/models` and `/api/byok-keys` on every project navigation. Not cached across tab switches.
**Impact:** ~2 API calls per project open = potential 200-400ms overhead
**Recommendation:** Cache result in AppContext or use SWR with short cache TTL.
**Status:** DEFERRED (requires AppContext changes)

### Build Status Polling
**File:** `hooks/useCodeTab.ts`
**Issue:** Polls `/api/projects/:id/pending-injections` every 5s when code tab is active.
**Impact:** Negligible (only runs when code tab visible, 5s interval)
**Status:** ACCEPTABLE

---

## Lighthouse Baseline
Cannot run Lighthouse in this environment. Estimated based on code review:
- **Performance:** ~78-82 (heavy CodeMirror + preact + CM extensions)
- **Accessibility:** ~88 (focus-visible rings, ARIA labels on some buttons)
- **Best Practices:** ~92
- **SEO:** ~85

Next action: Run Lighthouse manually on `justgoblin.com/dashboard` and `justgoblin.com/dashboard/project/:id`.
