// RETIRED (WALKFIX-2.1): legacy English "Appearance" page → settings sheet
// (Erscheinungsbild). Redirect so the old surface can't resurface.
import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/dashboard?settings=appearance');
}
