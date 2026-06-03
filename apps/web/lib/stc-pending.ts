// B-S4 / 10.6-4: Send-to-Code from a project-less chat stashes the code under
// `goblin:stc-pending` (sessionStorage), then the user picks/creates a project.
// The project HUB (/dashboard/project/[id]) doesn't mount the Code workspace, so
// a freshly-created project must deep-link into the Code tab — that's where
// CodeWorkspace rehydrates the stash. This returns the path suffix to append.

export const STC_PENDING_KEY = 'goblin:stc-pending';

export function hasPendingStc(): boolean {
  try {
    return !!sessionStorage.getItem(STC_PENDING_KEY);
  } catch {
    return false;
  }
}

/** '/work?tab=code' when a Send-to-Code payload is waiting, else '' (land on hub). */
export function pendingStcTab(): string {
  return hasPendingStc() ? '/work?tab=code' : '';
}
