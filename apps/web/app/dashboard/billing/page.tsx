// RETIRED: legacy English "Billing & Plan" page. The canonical billing surface
// is the German "Abrechnung" settings sheet (/dashboard?settings=billing); tier
// selection lives at /dashboard/upgrade. Redirect any old bookmark/link here to
// the canonical surface so the stale English page can't resurface.
import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/dashboard?settings=billing');
}
