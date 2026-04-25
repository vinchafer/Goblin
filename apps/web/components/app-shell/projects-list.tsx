"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';
import { Plus, Circle } from "lucide-react";
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
      <div className="px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--goblin-gray)' }}>
          Projects
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {projects.map(project => (
          <button
            key={project.id}
            onClick={() => {
              setActiveProject(project);
              router.push(`/dashboard/project/${project.id}`);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${activeProject?.id === project.id ? '' : 'hover:bg-gray-100'}`}
            style={{
              backgroundColor: activeProject?.id === project.id ? 'rgba(212, 169, 74, 0.1)' : 'transparent'
            }}
          >
            <Circle
              className="w-3 h-3 shrink-0"
              fill={project.color}
              strokeWidth={0}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: 'var(--goblin-slate)' }}>
                {project.name}
              </div>
              <div className="text-xs" style={{ color: 'var(--goblin-gray)' }}>
                {formatRelativeTime(project.last_active)}
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => setModalOpen(true)}
        className="mx-2 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
        style={{ color: 'var(--goblin-moss)' }}
      >
        <Plus className="w-4 h-4" />
        New Project
      </button>

      {modalOpen && (
        <NewProjectModal 
          onClose={() => setModalOpen(false)}
          onProjectCreated={onProjectCreated}
        />
      )}
    </div>
  );
}