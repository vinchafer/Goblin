"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Topbar } from "./topbar";
import { Sidebar } from "./sidebar";
import { BottomTabBar } from "./bottom-tab-bar";
import { useApp } from "@/contexts/app-context";
import type { Project } from "@goblin/shared/src/schemas";

interface DashboardShellProps {
  projects: Project[];
  children: React.ReactNode;
}

export function DashboardShell({ projects, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { activeTab, setActiveTab, injectionCount, activeModel } = useApp();
  const pathname = usePathname();

  const activeProjectId = (() => {
    const match = pathname.match(/\/dashboard\/project\/([^/]+)/);
    return match ? match[1] : undefined;
  })();

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) closeSidebar(); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [closeSidebar]);

  const activeProjectName = projects.find(p => p.id === activeProjectId)?.name;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--cream)', overflow: 'hidden' }}>
      <Topbar
        activeTab={activeTab as 'chat' | 'code' | 'preview'}
        onTabChange={tab => setActiveTab(tab)}
        onMenuToggle={() => setSidebarOpen(s => !s)}
        projectName={activeProjectName}
        selectedModel={activeModel.id}
        injectionCount={injectionCount}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div className="goblin-sidebar-desktop">
          <Sidebar
            projects={projects as any[]}
            activeProjectId={activeProjectId}
            isOpen={false}
          />
        </div>
        <Sidebar
          projects={projects as any[]}
          activeProjectId={activeProjectId}
          isOpen={sidebarOpen}
          onClose={closeSidebar}
        />
        <main style={{ flex: 1, overflow: 'auto', paddingBottom: 56 }}>
          {children}
        </main>
      </div>
      <BottomTabBar />
      <style>{`
        .goblin-sidebar-desktop { display: flex; }
        @media (max-width: 768px) { .goblin-sidebar-desktop { display: none !important; } }
      `}</style>
    </div>
  );
}
