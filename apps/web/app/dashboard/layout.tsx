import { createClient } from "@/lib/supabase/server";
import { AppProvider } from "@/contexts/app-context";
import { Topbar } from "@/components/app-shell/topbar";
import { Sidebar } from "@/components/app-shell/sidebar";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user?.id ?? '')
    .order('last_active', { ascending: false });

  return (
    <AppProvider>
      <div className="h-screen flex flex-col">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar projects={projects || []} />
          <main className="flex-1 overflow-auto" style={{ backgroundColor: 'var(--goblin-cream)' }}>
            {children}
          </main>
        </div>
      </div>
    </AppProvider>
  );
}