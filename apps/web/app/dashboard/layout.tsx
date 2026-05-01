import { createClient } from "@/lib/supabase/server";
import { AppProvider } from "@/contexts/app-context";
import { DashboardShell } from "@/components/app-shell/dashboard-shell";
import type { Project } from "@goblin/shared/src/schemas";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

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
      <DashboardShell
        projects={(projects as Project[]) || []}
        isFirstLogin={isFirstLogin}
        userName={user?.user_metadata?.full_name ?? user?.email}
      >
        {children}
      </DashboardShell>
    </AppProvider>
  );
}
