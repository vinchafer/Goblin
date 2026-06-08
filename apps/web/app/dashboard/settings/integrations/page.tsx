// RETIRED (WALKFIX-2.1): the old English desktop settings surface is gone. The
// canonical settings is the in-app sheet/modal (SettingsRoot/SettingsModal). This
// route redirects into it so the legacy page can never resurface — it is the page
// the founder landed on after GitHub OAuth.
import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/dashboard?settings=connectors');
}
