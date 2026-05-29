// Onboarding state hooks — wrap GET/PUT /api/onboarding/state.
// Backed by Supabase `onboarding_steps` + `users.onboarding_completed`.
// See routes/onboarding.ts (Hono).
'use client';

import { getAuthHeaders, API_URL } from '@/lib/api';

export type AiProviderChoice = 'byok' | 'no_key' | 'free_tier';
export type ToolsPreset = 'indie' | 'starter' | 'all_on';

export interface ToolsSelection {
  preset: ToolsPreset;
  tools: string[];
}

export interface OnboardingStatePatch {
  current_step?: number;
  completed?: boolean;
  ai_provider_choice?: AiProviderChoice | null;
  code_hosting_choice?: 'github' | 'goblin_cloud' | null;
  deploy_choice?: 'vercel' | 'preview_only' | 'skip' | null;
  skipped_steps?: number[];
  tools_selection?: ToolsSelection | null;
}

export interface OnboardingState extends OnboardingStatePatch {
  // Shape returned by GET /api/onboarding/state. All fields nullable.
}

export async function patchOnboardingState(patch: OnboardingStatePatch): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${API_URL}/api/onboarding/state`, {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: JSON.stringify(patch),
    });
  } catch {
    // Non-blocking. State persistence is best-effort; UI flow continues.
  }
}

export async function getOnboardingState(): Promise<OnboardingState | null> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/api/onboarding/state`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) return null;
    return (await res.json()) as OnboardingState;
  } catch {
    return null;
  }
}
