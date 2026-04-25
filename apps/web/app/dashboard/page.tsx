import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // @ts-ignore supabase-js v2.104 / ssr v0.5 type mismatch
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('last_active', { ascending: false })
    .limit(1) as unknown as { data: Array<{ id: string }> | null };

  const firstProject = projects?.[0];
  if (firstProject) {
    redirect(`/dashboard/project/${firstProject.id}`);
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--goblin-slate)' }}>
          Welcome to Goblin 🔨
        </h1>
        <p className="text-base" style={{ color: 'var(--goblin-gray)' }}>
          Create your first project to start building. Click the <strong>New Project</strong> button in the sidebar to get started.
        </p>
      </div>
    </div>
  );
}