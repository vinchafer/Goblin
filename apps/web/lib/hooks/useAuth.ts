'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useAuth() {
  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, []);

  return { signOut };
}
