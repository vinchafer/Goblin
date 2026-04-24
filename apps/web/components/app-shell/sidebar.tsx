import { ProjectsList } from "./projects-list";
import { BuildStatus } from "./build-status";
import { UsageIndicators } from "./usage-indicators";
import type { Project } from "@goblin/shared/src/schemas";

interface SidebarProps {
  projects: Project[];
}

export function Sidebar({ projects }: SidebarProps) {
  return (
    <aside
      className="w-72 flex flex-col border-r shrink-0"
      style={{
        backgroundColor: 'var(--goblin-cream)',
        borderColor: 'var(--goblin-light)'
      }}
    >
      <ProjectsList projects={projects} />
      <BuildStatus />
      <UsageIndicators />
    </aside>
  );
}