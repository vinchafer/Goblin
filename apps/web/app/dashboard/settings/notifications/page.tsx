// RETIRED (WALKFIX-2.1): legacy English "Notifications" page → settings sheet
// (Benachrichtigungen). Redirect so the old surface can't resurface.
import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/dashboard?settings=notifications');
}
