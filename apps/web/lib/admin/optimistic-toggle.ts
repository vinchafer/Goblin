// FOUNDER-WALK-2 U5.3 — Models availability toggle reconciliation.
//
// The toggle awaited the PATCH and then UNCONDITIONALLY flipped local state:
//   await fetch(... {available: !m.available});
//   setModels(prev => prev.map(x => x.id===m.id ? {...x, available:!x.available} : x));
// so when the request failed the UI still flipped — the optimistic state
// diverged from server truth (a model shown "On" that the server still has
// "Off"). The fix flips optimistically, then on failure RECONCILES back to the
// known server value. These pure helpers are the tested reconciliation core.

export interface Toggleable {
  id: string;
  available: boolean;
}

/** Set one model's `available` to an explicit value (used for the optimistic
 *  flip AND for the revert — same operation, different target). */
export function setAvailability<T extends Toggleable>(models: T[], id: string, available: boolean): T[] {
  return models.map((m) => (m.id === id ? { ...m, available } : m));
}

/**
 * Reconcile after a toggle attempt.
 * @param serverValue the availability the SERVER is known to hold (i.e. the
 *   pre-toggle value on failure, or the confirmed value on success).
 * On failure this reverts the optimistic flip so the UI can never claim a state
 * the server did not accept.
 */
export function reconcileToggle<T extends Toggleable>(models: T[], id: string, serverValue: boolean): T[] {
  return setAvailability(models, id, serverValue);
}
