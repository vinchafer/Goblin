import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FileExplorer } from "@/components/files/FileExplorer";

export const dynamic = "force-dynamic";

interface PageProps { params: Promise<{ id: string }>; }

export default async function ProjectFilesPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .eq("user_id", user.id)
    .single() as { data: { id: string; name: string } | null };

  if (!project) notFound();

  return (
    <div style={{ height: "100%" }}>
      <FileExplorer projectId={id} projectName={project.name} />
    </div>
  );
}
