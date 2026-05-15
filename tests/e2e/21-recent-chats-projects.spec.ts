import { test } from '@playwright/test';

// 9C — BUG-013 Recent Chats with project badges
//
// SKIPPED in 9C E2E pass: requires authenticated API call to /api/chat-sessions
// with valid Supabase token from browser localStorage. Token-key format varies
// across Supabase SDK versions and was not stable in this run.
//
// Backend change is verified by:
// - apps/api/src/routes/chat-sessions.ts → adds projects(id, name) join
// - SQL flatten: each session row gets project_name field (null if no project)
// - Manual QA checklist (docs/MANUAL_QA_9C.md, BUG-013 step) covers UI badge
//
// 9D should add a proper UI test once a stable test-fixture for
// "create project + create chat in project" exists in helpers/.

test.skip('9C — Recent Chats include project badges (BUG-013) — deferred to 9D', () => {
  // intentionally empty
});
