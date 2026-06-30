'use client';

// Single source of truth for the onboarding ("Preference Flow") step order,
// the experience branch, and the honest header/footer step counter.
//
// Why this exists (Sprint 11 — onboarding restructure): the old chrome hard-
// coded TOTAL_STEPS=6 while each page ALSO embedded its own "Schritt 0X von 06"
// string, which drifted out of sync (the founder's off-by-one bug). Numbering
// now lives ONLY here; pages render descriptive eyebrows with no numbers.
//
// The flow forks on whether the user already knows "vibe coding":
//   • YES → straight through the standard steps.
//   • NO  → an extra encouraging EXPLAINER step is inserted, so the total grows
//           by one (honest: this user genuinely sees one more screen).
// provider / tools / integrations are OPTIONAL, off-the-numbered-flow pages
// (BYOK is optional; tools is feature-flagged off) → they show no counter.

export type VibeKnown = 'yes' | 'no';

// Tools step is hidden by default (Sprint 11): all code/components are retained
// but the step is off the live path. Flip NEXT_PUBLIC_ONBOARDING_TOOLS_STEP=true
// to re-enable it. While off, /welcome/tools redirects into the flow and the
// fake "84% / 8 active / BALD-toggled-on" presentation never reaches a user.
export const TOOLS_STEP_ENABLED =
  process.env.NEXT_PUBLIC_ONBOARDING_TOOLS_STEP === 'true';

const VK_KEY = 'goblin:vibe-known';

export function readVibeKnown(): VibeKnown | null {
  try {
    const v = window.localStorage.getItem(VK_KEY);
    if (v === 'yes' || v === 'no') return v;
  } catch {
    /* ignore — treat as unknown */
  }
  return null;
}

export function setVibeKnown(v: VibeKnown): void {
  try {
    window.localStorage.setItem(VK_KEY, v);
  } catch {
    /* ignore */
  }
}

// Numbered steps, in visit order. Routes reused from the existing flow:
//   /welcome/language → language (kept)
//   /welcome          → experience fork (was the old hero, repurposed)
//   /welcome/routing  → "How Goblin works" (revised, honest)
//   /welcome/models   → models + consumption (new)
//   /welcome/build    → first build with Goblin Swift (new) → dashboard
const FLOW_YES: string[] = [
  '/welcome/language',
  '/welcome',
  '/welcome/routing',
  '/welcome/models',
  '/welcome/build',
];

// NO branch inserts the explainer right after the experience fork.
const FLOW_NO: string[] = [
  '/welcome/language',
  '/welcome',
  '/welcome/explainer',
  '/welcome/routing',
  '/welcome/models',
  '/welcome/build',
];

export function activeFlow(vibe: VibeKnown | null): string[] {
  return vibe === 'no' ? FLOW_NO : FLOW_YES;
}

// Next numbered route after `pathname` for the given branch, or null if there
// is none (last step → caller routes to /dashboard). Off-flow pages return null.
export function nextStep(pathname: string, vibe: VibeKnown | null): string | null {
  const flow = activeFlow(vibe);
  const i = flow.indexOf(pathname);
  if (i === -1 || i === flow.length - 1) return null;
  return flow[i + 1] ?? null;
}

// Previous numbered route, or null.
export function prevStep(pathname: string, vibe: VibeKnown | null): string | null {
  const flow = activeFlow(vibe);
  const i = flow.indexOf(pathname);
  if (i <= 0) return null;
  return flow[i - 1] ?? null;
}

// 1-indexed {step, total} for the counter, or null for OFF-FLOW optional pages
// (provider / tools / integrations) — those render without a step chip.
export function stepInfo(
  pathname: string,
  vibe: VibeKnown | null,
): { step: number; total: number } | null {
  const flow = activeFlow(vibe);
  const i = flow.indexOf(pathname);
  if (i === -1) return null;
  return { step: i + 1, total: flow.length };
}
