'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { performSignOut, browserSignOutEnvironment } from '@/lib/auth/sign-out';
import { readLang, t } from '@/lib/use-lang';

/**
 * The hook behind the avatar menu (header) and the settings page. Both call the
 * same `performSignOut` as the command palette does — one mechanism, so a fix
 * lands everywhere at once. See lib/auth/sign-out.ts for the defect it closes.
 */
export function useAuth() {
  const signOut = useCallback(async () => {
    const supabase = createClient();
    const result = await performSignOut(
      browserSignOutEnvironment(() => supabase.auth.signOut()),
    );

    if (!result.ok) {
      // The session survived. Saying nothing while staying signed in is the
      // false state Law 6 forbids, so say what is actually true.
      const lang = readLang();
      toast.error(
        t(
          lang,
          'Abmelden fehlgeschlagen — du bist weiterhin angemeldet. Bitte prüfe deine Verbindung und versuche es erneut.',
          'Sign-out failed — you are still signed in. Check your connection and try again.',
        ),
      );
    }

    return result;
  }, []);

  return { signOut };
}
