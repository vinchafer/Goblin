"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Circle, Plus } from "@phosphor-icons/react";
import { useApp } from "@/contexts/app-context";
import type { Project } from "@goblin/shared/src/schemas";
import { NewProjectModal } from "./new-project-modal";

interface ProjectsListProps {
  projects: Project[];
  onProjectCreated?: (project: Project) => void;
}

export function ProjectsList({ projects, onProjectCreated }: ProjectsListProps) {
  const { activeProject, setActiveProject } = useApp();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  const formatRelativeTime = (date: Date | string) => {
    const now = new Date();
    const past = new Date(date);
    const diff = Math.floor((now.getTime() - past.getTime()) / 60000);
    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* New project button */}
      <div className="p-3">
        <button
          onClick={() => setModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 h-8 rounded-lg text-sm font-medium text-white transition-colors"
          style={{
            backgroundColor: "var(--brand-green)",
            fontFamily: "var(--font-sans)"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--green-600)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--brand-green)")}
        >
          <Plus className="w-3.5 h-3.5" />
          New Project
        </button>
      </div>

      {/* Label */}
      <div className="px-3 pb-1">
        <span
          className="text-[10px] font-medium uppercase tracking-widest"
          style={{ color: "var(--ink-3)", fontFamily: "var(--font-sans)" }}
        >
          Projects
        </span>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {projects.length === 0 ? (
          <div className="px-2.5 py-4 text-center">
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--ink-2)' }}>
              No projects yet
            </div>
            <div className="text-[10px]" style={{ color: 'var(--ink-3)' }}>
              Click above to create your first
            </div>
          </div>
        ) : (
          projects.map((project) => {
            const isActive = activeProject?.id === project.id;
            return (
              <button
                key={project.id}
                onClick={() => {
                  setActiveProject(project);
                  router.push(`/dashboard/project/${project.id}`);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-150"
                style={{
                  backgroundColor: isActive ? "rgba(201,147,58,0.1)" : "transparent",
                  border: isActive ? "1px solid rgba(201,147,58,0.2)" : "1px solid transparent"
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      "rgba(0,0,0,0.04)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                  }
                }}
              >
                <Circle
                  className="w-2.5 h-2.5 shrink-0"
                  fill={project.color}
                  strokeWidth={0}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-xs font-medium truncate"
                    style={{
                      color: isActive ? "var(--brand-gold)" : "var(--ink-2)",
                      fontFamily: "var(--font-sans)"
                    }}
                  >
                    {project.name}
                  </div>
                  <div
                    className="text-[10px]"
                    style={{ color: "var(--ink-3)", fontFamily: "var(--font-sans)" }}
                  >
                    {formatRelativeTime(project.last_active)}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {modalOpen && (
        <NewProjectModal
          onClose={() => setModalOpen(false)}
          onProjectCreated={onProjectCreated}
        />
      )}
    </div>
  );
}
