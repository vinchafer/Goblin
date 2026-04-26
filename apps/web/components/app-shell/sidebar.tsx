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
      className="w-[220px] flex flex-col border-r shrink-0 overflow-hidden"
      style={{
        backgroundColor: "var(--goblin-cream)",
        borderColor: "var(--goblin-border)"
      }}
    >
      <ProjectsList projects={projects} />
      <BuildStatus />
      <UsageIndicators />
    </aside>
  );
}
