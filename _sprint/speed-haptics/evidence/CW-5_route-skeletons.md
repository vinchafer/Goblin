# CW-5 — Route loading skeletons (evidence)

**Offender (DIAGNOSIS Part C.4):** only 2 `loading.tsx` for 76 pages; every heavy dynamic dashboard segment blocked the transition on `force-dynamic` DB work with **no tailored boundary** — the nearest one (`dashboard/loading.tsx`) is a **project-list** skeleton, the wrong shape for chat/editor/file screens.

**Fix:** added a per-segment `loading.tsx` for the 6 missing dynamic routes, each matching its real layout (they render inside `DashboardShell`, so each fills only the content area). All are **server components** using the global `.skeleton` class (globals.css:186 + `skeleton-loading` keyframe:191) — no client JS, no imports.

| Route | New file | Shape |
|-------|----------|-------|
| `chat/[sessionId]` | `.../loading.tsx` | Chat thread — alternating user/assistant bubbles + composer bar |
| `project/[id]` | `.../loading.tsx` | Workspace — context bar + tab row + content panel + status line |
| `project/[id]/work` | `.../loading.tsx` | Editor — file rail + code lines w/ gutter |
| `project/[id]/files` | `.../loading.tsx` | File list — rows w/ icon + name + meta |
| `projects/[id]` | `.../loading.tsx` | Workspace (this route is a fast redirect to `project/[id]` — matches the destination so no wrong-skeleton flash) |
| `chats` | `.../loading.tsx` | Chat list — header + list rows |

**Pairs with CW-2:** the chat back button prefetches `/dashboard/project/[id]`; with this route's new `loading.tsx`, the back tap paints the workspace skeleton on the same frame, then hydrates.

**Gate (deterministic):** all 6 files present under their segment dirs (`git status` shows the six new `loading.tsx`); `.skeleton` class + keyframe confirmed at globals.css:186/191; files are import-free server components (no `'use client'`), so they add zero client bundle.

**Regression:** purely additive — no page component or existing loading boundary changed. Next.js picks up a segment `loading.tsx` automatically; nothing else references these files.
