"use client";

import { useState, useCallback, useEffect } from "react";
import { Topbar } from "./topbar";
import { Sidebar } from "./sidebar";
import { BottomTabBar } from "./bottom-tab-bar";
import type { Project } from "@goblin/shared/src/schemas";

interface DashboardShellProps {
  projects: Project[];
  children: React.ReactNode;
}

export function DashboardShell({ projects, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  // Close sidebar on route change (when children change)
  useEffect(() => {
    closeSidebar();
  }, [children, closeSidebar]);

  // Close sidebar on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        closeSidebar();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [closeSidebar]);

  return (
    <div className="h-screen flex flex-col">
      <Topbar onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar — always visible on md+ */}
        <div className="hidden md:block">
          <Sidebar projects={projects} />
        </div>

        {/* Mobile drawer overlay */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/30"
              onClick={closeSidebar}
            />
            {/* Drawer */}
            <div className="relative w-72 h-full shadow-xl z-50 animate-slide-in-left">
              <Sidebar projects={projects} />
            </div>
          </div>
        )}

        <main
          className="flex-1 overflow-auto pb-14 md:pb-0"
          style={{ backgroundColor: 'var(--goblin-cream)' }}
        >
          {children}
        </main>
      </div>

      {/* Bottom tab bar — mobile only */}
      <BottomTabBar />
    </div>
  );
}