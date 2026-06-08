// RETIRED (WALKFIX-2.1): legacy English "API Keys" page → the canonical "Meine
// Keys" lives in the settings sheet (Modelle → Meine Keys). Redirect so it can't
// resurface.
import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/dashboard?settings=models');
}
