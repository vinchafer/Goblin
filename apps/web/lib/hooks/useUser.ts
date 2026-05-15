'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  displayName: string;
  avatarUrl?: string;
  plan: { name: 'Build' | 'Pro' | 'Power' };
  githubConnected: boolean;
}

interface UseUserResult extends UserProfile {
  user: UserProfile;
  loading: boolean;
  updateProfile: (patch: { fullName?: string; displayName?: string }) => Promise<void>;
  refresh: () => Promise<void>;
}

const EMPTY: UserProfile = {
  id: '',
  email: '',
  fullName: '',
  displayName: '',
  avatarUrl: undefined,
  plan: { name: 'Build' },
  githubConnected: false,
};

export function useUser(): UseUserResult {
  const [profile, setProfile] = useState<UserProfile>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setProfile(EMPTY);
      setLoading(false);
      return;
    }
    const u = session.user;
    const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
    const identities = u.identities ?? [];
    setProfile({
      id: u.id,
      email: u.email ?? '',
      fullName: (meta.full_name as string) ?? (meta.name as string) ?? '',
      displayName: (meta.display_name as string) ?? '',
      avatarUrl: (meta.avatar_url as string) ?? undefined,
      plan: { name: ((meta.plan as string) ?? 'Build') as 'Build' | 'Pro' | 'Power' },
      githubConnected: identities.some((i) => i.provider === 'github'),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateProfile = useCallback(async (patch: { fullName?: string; displayName?: string }) => {
    const supabase = createClient();
    await supabase.auth.updateUser({
      data: {
        ...(patch.fullName !== undefined ? { full_name: patch.fullName } : {}),
        ...(patch.displayName !== undefined ? { display_name: patch.displayName } : {}),
      },
    });
    await load();
  }, [load]);

  return { ...profile, user: profile, loading, updateProfile, refresh: load };
}
