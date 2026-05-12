import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectWorkspace } from "@/components/project/project-workspace";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name, description, preview_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single() as { data: { id: string; name: string; description: string | null; preview_url: string | null } | null; error: unknown };

  if (error || !project) {
    notFound();
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ProjectWorkspace projectId={id} projectName={project.name} previewUrl={project.preview_url} />
    </div>
  );
}
