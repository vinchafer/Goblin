// RETIRED (WALKFIX-2.1): legacy English "Plan & Billing" page → settings sheet
// (Abrechnung). Redirect so the old surface can't resurface.
import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/dashboard?settings=billing');
}
