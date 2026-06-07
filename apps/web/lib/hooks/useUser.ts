'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { apiGet } from '@/lib/api';
import { planLabel } from '@/lib/plan-label';
import { resolveDisplayName } from '@/lib/display-name';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  displayName: string;
  avatarUrl?: string;
  plan: { name: string };
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
  plan: { name: 'Trial' },
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

    // FIX2-4 (BUG-15): the plan badge must reflect the authoritative server
    // state, not a stale `user_metadata.plan` that defaults to "Build". Fetch
    // the real plan + is_comped; fall back gracefully if the API is unreachable.
    let planName = 'Trial';
    try {
      const me = await apiGet<{ plan?: string; is_comped?: boolean }>('/api/users/me');
      planName = planLabel(me?.plan, me?.is_comped);
    } catch {
      planName = planLabel((meta.plan as string) ?? null);
    }

    // FIX3-4: single canonical display name for pill + ProfileCard + everywhere.
    const resolvedName = resolveDisplayName(meta, u.email);
    setProfile({
      id: u.id,
      email: u.email ?? '',
      fullName: resolvedName,
      displayName: resolvedName,
      avatarUrl: (meta.avatar_url as string) ?? undefined,
      plan: { name: planName },
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
