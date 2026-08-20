'use client';

// FOUNDER-WALK-7 · U4(a)(b) — the profile "revert" and stale-initial bugs were never a
// save/refetch race: `useUser()` was a plain hook, instantiated independently by every
// consumer (Sidebar, AvatarMenu, ProfilePage, SettingsRoot, standalone-chat). Settings
// renders as a Sheet/Modal INSIDE the same tree as Sidebar/AvatarMenu (not a route
// navigation), so all of them stay mounted at once with their own separate copy of
// `profile`. Saving in ProfilePage only ever updated its own copy — Sidebar's and
// AvatarMenu's initial-letter avatar kept showing the pre-save snapshot until some
// unrelated remount happened to occur. That reads exactly like "reverted" / "the new
// initial doesn't show up" — because until this fix, it hadn't actually re-rendered.
//
// Fix: the exact same load()/updateProfile() logic, now instantiated ONCE behind a
// Context and shared. A save in ProfilePage calls the ONE load(), which updates the
// ONE profile state every consumer reads — Sidebar and AvatarMenu update in the same
// tick, no remount required.

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { apiGet } from '@/lib/api';
import { isDemoActive } from '@/lib/demo/demo-flag';
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

export interface UseUserResult extends UserProfile {
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

const UserContext = createContext<UseUserResult | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
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
    // Demo (Sprint 10 §7): no network — derive the plan from the seed metadata.
    if (isDemoActive()) {
      planName = planLabel((meta.plan as string) ?? null);
    } else {
      try {
        const me = await apiGet<{ plan?: string; is_comped?: boolean }>('/api/users/me');
        planName = planLabel(me?.plan, me?.is_comped);
      } catch {
        planName = planLabel((meta.plan as string) ?? null);
      }
    }

    // FIX3-4: single canonical display name for pill + ProfileCard + everywhere.
    const resolvedName = resolveDisplayName(meta, u.email);
    // The "Vollständiger Name" field is its own stored value (auth metadata
    // `full_name`). Read it RAW so editing it round-trips on reload — the canonical
    // resolver (display_name-priority) drives `displayName` only, otherwise an edit
    // to full_name would be silently overwritten by display_name on the next load.
    const rawFullName =
      typeof meta.full_name === 'string' && meta.full_name.trim() ? meta.full_name.trim() : resolvedName;
    setProfile({
      id: u.id,
      email: u.email ?? '',
      fullName: rawFullName,
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
    // U4(a) hardening: a transient failure here (expired token, rate limit) used to be
    // discarded silently — updateUser()'s result went unchecked, so load() below just
    // re-read the UNCHANGED old value, indistinguishable from "didn't stick." Now a
    // real failure is surfaced to the caller instead of masquerading as a no-op save.
    const { error } = await supabase.auth.updateUser({
      data: {
        ...(patch.fullName !== undefined ? { full_name: patch.fullName } : {}),
        ...(patch.displayName !== undefined ? { display_name: patch.displayName } : {}),
      },
    });
    if (error) throw error;
    await load();
  }, [load]);

  const value: UseUserResult = { ...profile, user: profile, loading, updateProfile, refresh: load };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UseUserResult {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
}
