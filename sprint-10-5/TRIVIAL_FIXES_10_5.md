# Trivial Fixes — Sprint 10.5 (incidental, out of slice scope)

- 👺 emoji used as a brand glyph in non-Max headers: app/(legal)/layout.tsx,
  app/status/page.tsx, app/badge/page.tsx, components/admin/admin-shell.tsx.
  Not loading states (B-S10 targeted loading regressions). Replace with
  GoblinLogo in a future polish pass for full "old logo nowhere" compliance.
- Two new-project modals exist (components/projects/* canonical via shell after
  B-S6; components/app-shell/new-project-modal.tsx now only via projects-list).
  Consider consolidating to one.
