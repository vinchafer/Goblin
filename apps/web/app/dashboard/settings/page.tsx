// B7 (Sprint 2): the legacy top-level /dashboard/settings index hung on
// "WORKSPACE WIRD GELADEN". Real settings live in SettingsRoot/SettingsModal (opened from
// the dashboard) and in the /dashboard/settings/<section> sub-pages. Redirect the dead index
// to the dashboard so the URL no longer hangs. Sub-section routes are untouched.
import { redirect } from 'next/navigation';

export default function SettingsIndexRedirect() {
  // WALKFIX-2.1: open the canonical settings sheet (Profil) instead of dropping to
  // a bare dashboard.
  redirect('/dashboard?settings=profile');
}
