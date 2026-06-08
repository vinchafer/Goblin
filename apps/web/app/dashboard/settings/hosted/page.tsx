// RETIRED (WALKFIX-2.1): legacy "Hosted AI" page → covered by the settings sheet
// (Modelle). Redirect so the old English surface can't resurface.
import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/dashboard?settings=models');
}
