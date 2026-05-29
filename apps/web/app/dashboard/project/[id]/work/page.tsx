import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectWorkspace } from "@/components/project/project-workspace";

export const dynamic = 'force-dynamic';

interface WorkspacePageProps {
  params: Promise<{ id: string }>;
  // The route accepts ?tab=chat|code|preview so /dashboard/project/[id]
  // (overview) can deep-link people into the right workspace tab.
  searchParams: Promise<{ tab?: string }>;
}

export default async function ProjectWorkspacePage({ params, searchParams }: WorkspacePageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, preview_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single() as { data: { id: string; name: string; preview_url: string | null } | null };

  if (!project) notFound();

  // searchParams ?tab=… is forwarded via window history so the client
  // workspace switches tabs on mount. We do NOT compute it on the server
  // since activeTab is client state in AppProvider.
  void searchParams;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ProjectWorkspace projectId={id} projectName={project.name} previewUrl={project.preview_url} />
    </div>
  );
}
