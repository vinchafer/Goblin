import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', user?.id)
    .order('last_active', { ascending: false })
    .limit(1);

  if (projects && projects.length > 0) {
    redirect(`/project/${projects[0].id}`);
  } else {
    redirect(`/dashboard/new`);
  }
}