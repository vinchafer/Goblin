import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectWorkspace } from "@/components/project/project-workspace";
import type { Project } from "@goblin/shared/src/schemas";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Get session to get auth token
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    redirect('/login');
  }

  try {
    // Fetch project from API
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    const response = await fetch(`${apiBase}/api/projects/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 404) {
        notFound();
      }
      throw new Error(`Failed to fetch project: ${response.status}`);
    }

    const project: Project = await response.json();

    // Verify ownership (API should have done this, but double-check)
    if (project.user_id !== session.user.id) {
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

        <ProjectWorkspace projectId={id} previewUrl={(project as any).preview_url} />
      </div>
    );
  } catch (error) {
    console.error('Error fetching project:', error);
    notFound();
  }
}