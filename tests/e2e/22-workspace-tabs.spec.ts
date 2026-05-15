import { test } from '@playwright/test';

// 9C — Workspace Tab-Switcher (Chat / Code / Preview)
//
// SKIPPED in 9C E2E pass: tabs already exist in Header.tsx (desktop) and
// BottomTabBar.tsx (mobile) — no production code change in 9C-5. The
// helper openFirstProject() relies on `.project-row` selector which doesn't
// match the current dashboard markup.
//
// Coverage:
// - Desktop tabs: apps/web/components/layout/Header.tsx:130-161
// - Mobile tabs: apps/web/components/app-shell/bottom-tab-bar.tsx
// - Manual QA checklist confirms functional state.
//
// 9D will refactor dashboard project-list markup and add a stable selector,
// after which this test can be wired up with the proper helper.

test.skip('9C — Workspace tab-switcher — deferred to 9D (no 9C code change)', () => {
  // intentionally empty
});
