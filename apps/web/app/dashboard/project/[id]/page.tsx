import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectWorkspace } from "@/components/project/project-workspace";

interface ProjectPageProps {
  params: {
    id: string;
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const supabase = await createClient();

  // @ts-ignore supabase-js v2.104 / ssr v0.5 type mismatch
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
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
      
      <ProjectWorkspace projectId={params.id} />
    </div>
  );
}