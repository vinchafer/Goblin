import type { Viewport } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Manrope, Instrument_Serif } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { resolveOnboardingGate, ONBOARDED_COOKIE } from "@/lib/onboarding-gate";
import { AppProvider } from "@/contexts/app-context";
import { DashboardShell } from "@/components/app-shell/dashboard-shell";
import { filterVisibleProjects } from "@/lib/project-visibility";
import { AdvancedModeProvider } from "@/components/ui/advanced-mode-provider";
import SoftLimitBanner from "@/components/onboarding/SoftLimitBanner";
import "../../styles/dashboard-tokens.css";

// App route (B-S9): lock zoom on the dashboard so pinch-zoom can't break the
// mobile workspace layout. Marketing routes keep zoom (root layout).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1A3A2A",
};

// Scoped font variables for the .gobl-dash wrapper. Manrope + Instrument
// Serif are also loaded globally in app/layout.tsx; these scoped loaders
// just expose them under the --font-dash-* variable names the dashboard
// component CSS references.
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-dash-display',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-dash-serif',
  display: 'swap',
  weight: '400',
  style: ['normal', 'italic'],
});

export const dynamic = 'force-dynamic';
import type { Project } from "@goblin/shared/src/schemas";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Check if new user needs onboarding (created within last 10 minutes, no completed onboarding)
  const createdAt = new Date(user.created_at);
  const isNewUser = (Date.now() - createdAt.getTime()) < 10 * 60 * 1000;

  // Reactivated accounts (cancelled a pending deletion) are returning users, not
  // fresh signups — but a throwaway test account is still < 10 min old, so the
  // isNewUser heuristic wrongly classifies them as new and replays onboarding.
  // reactivate() stamps user_metadata.deletion_status='cancelled'; route those
  // users forward (dashboard → trial-gate guard) instead of into /welcome.
  const isReactivated = user.user_metadata?.deletion_status === 'cancelled';

  if (isNewUser && !isReactivated) {
    // F-05: the synchronous completion handshake. Set by welcome/build (and the
    // chrome guard) the instant onboarding finishes — trusted here regardless of
    // DB replication lag / RLS read-asymmetry, so a stale `completed === false`
    // read can never bounce a just-finished user back into /welcome (the loop).
    const justOnboarded = (await cookies()).get(ONBOARDED_COOKIE.name)?.value === ONBOARDED_COOKIE.value;

    const { data: onboardingState } = await supabase
      .from('onboarding_steps')
      .select('completed')
      .eq('user_id', user.id)
      .single() as { data: { completed: boolean } | null };

    const { redirectToOnboarding } = resolveOnboardingGate({
      isNewUser,
      isReactivated,
      onboardingCompleted: !!onboardingState?.completed,
      justOnboarded,
    });

    if (redirectToOnboarding) {
      redirect('/welcome/language');
    }
  }

  const [{ data: projects }, { data: keys }] = await Promise.all([
    supabase
      .from('projects')
      .select('*')
      .eq('user_id', user?.id ?? '')
      .order('last_active', { ascending: false }),
    supabase
      .from('byok_keys')
      .select('id')
      .eq('user_id', user?.id ?? '')
      .limit(1),
  ]);

  const isFirstLogin = (projects?.length ?? 0) === 0 && (keys?.length ?? 0) === 0;

  return (
    <div className={`gobl-dash ${manrope.variable} ${instrumentSerif.variable}`}>
      <AppProvider>
        <AdvancedModeProvider>
          <SoftLimitBanner />
          <DashboardShell
            projects={filterVisibleProjects((projects as Project[]) || [])}
            isFirstLogin={isFirstLogin}
            userName={user?.user_metadata?.full_name ?? user?.email}
          >
            {children}
          </DashboardShell>
        </AdvancedModeProvider>
      </AppProvider>
    </div>
  );
}
