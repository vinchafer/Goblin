import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppProvider } from "@/contexts/app-context";
import { DashboardShell } from "@/components/app-shell/dashboard-shell";
import type { Project } from "@goblin/shared/src/schemas";

export default async function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("last_active", { ascending: false });

  return (
    <AppProvider>
      <DashboardShell projects={(projects as Project[]) || []}>
        {children}
      </DashboardShell>
    </AppProvider>
  );
}
