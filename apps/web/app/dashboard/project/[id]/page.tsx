import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectWorkspace } from "@/components/project/project-workspace";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, description')
    .eq('id', id)
    .single() as unknown as { data: { id: string; name: string; description: string | null } | null };

  if (!project) {
    notFound();
  }

  return (
    <div className="h-full">
      <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--goblin-light)' }}>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--goblin-slate)' }}>{project.name}</h1>
        {project.description && (
          <p className="text-sm mt-1" style={{ color: 'var(--goblin-gray)' }}>{project.description}</p>
        )}
      </div>

      <ProjectWorkspace projectId={id} />
    </div>
  );
}