import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppProvider } from "@/contexts/app-context";
import { DashboardShell } from "@/components/app-shell/dashboard-shell";
import { AdvancedModeProvider } from "@/components/ui/advanced-mode-provider";
import SoftLimitBanner from "@/components/onboarding/SoftLimitBanner";

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

  if (isNewUser) {
    const { data: onboardingState } = await supabase
      .from('onboarding_steps')
      .select('completed')
      .eq('user_id', user.id)
      .single() as { data: { completed: boolean } | null };

    if (!onboardingState?.completed) {
      redirect('/onboarding');
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
    <AppProvider>
      <AdvancedModeProvider>
        <SoftLimitBanner />
        <DashboardShell
          projects={(projects as Project[]) || []}
          isFirstLogin={isFirstLogin}
          userName={user?.user_metadata?.full_name ?? user?.email}
        >
          {children}
        </DashboardShell>
      </AdvancedModeProvider>
    </AppProvider>
  );
}
