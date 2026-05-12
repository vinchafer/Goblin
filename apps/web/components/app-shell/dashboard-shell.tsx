"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { TrialBanner } from "@/components/app-shell/trial-banner";
import { SupportBubble } from "@/components/support/support-bubble";
import { CommandPalette, useCommandPalette } from "@/components/ui/CommandPalette";
import { ShortcutsHelp } from "@/components/ui/ShortcutsHelp";
import { ShortcutsTooltip } from "@/components/ui/ShortcutsTooltip";
import dynamic from "next/dynamic";
const FirstRunTour = dynamic(() => import("@/components/onboarding/first-run-tour").then(m => m.FirstRunTour), { ssr: false });
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useApp } from "@/contexts/app-context";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@goblin/shared/src/schemas";

interface DashboardShellProps {
  projects: Project[];
  children: React.ReactNode;
  previewUrl?: string | null;
  isFirstLogin?: boolean;
  userName?: string;
}

export function DashboardShell({ projects, children, previewUrl, isFirstLogin, userName }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { activeTab, setActiveTab, injectionCount, setShowNewProjectModal, previewUrl: contextPreviewUrl } = useApp();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }, [router]);

  const commands = useCommandPalette({
    projects: projects.map(p => ({ id: p.id, name: p.name })),
    onNewProject: () => setShowNewProjectModal(true),
    onToggleSidebar: () => setMobileOpen(s => !s),
    onLogout: handleLogout,
  });

  useKeyboardShortcuts({
    onCommandPalette: () => setCmdPaletteOpen(true),
    onTabChat: () => setActiveTab('chat'),
    onTabCode: () => setActiveTab('code'),
    onTabPreview: () => setActiveTab('preview'),
    onToggleSidebar: () => setMobileOpen(s => !s),
    onSettings: () => router.push('/dashboard/settings'),
    onNewProject: () => setShowNewProjectModal(true),
    onShortcutsHelp: () => setShortcutsOpen(true),
    onFocusChat: () => {
      const input = document.querySelector<HTMLElement>('[data-chat-input]');
      input?.focus();
    },
  });

  // Show first-run tour if redirected from onboarding (?tour=1) or fresh account
  useEffect(() => {
    const tourDone = localStorage.getItem('goblin_tour_done');
    if (tourDone) return;

    const fromOnboarding = new URLSearchParams(window.location.search).get('tour') === '1';
    if (fromOnboarding || isFirstLogin) {
      setShowTour(true);
    }
  }, [isFirstLogin]);

  const handleTourDone = useCallback(() => {
    setShowTour(false);
    if (typeof window !== 'undefined') localStorage.setItem('goblin_tour_done', '1');
  }, []);

  const activeProjectId = (() => {
    const match = pathname.match(/\/project\/([^/]+)/);
    return match ? match[1] : undefined;
  })();

  const isWorkspace = !!activeProjectId;

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => { closeMobile(); }, [pathname, closeMobile]);

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) closeMobile(); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [closeMobile]);

  const activeProjectName = projects.find(p => p.id === activeProjectId)?.name;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--cream)', overflow: 'hidden' }}>
      <Header
        activeTab={activeTab as 'chat' | 'code' | 'preview'}
        onTabChange={tab => setActiveTab(tab)}
        onMenuToggle={() => setMobileOpen(s => !s)}
        projectName={activeProjectName}
        showTabs={isWorkspace}
        injectionCount={injectionCount}
        previewUrl={contextPreviewUrl ?? undefined}
      />
      <TrialBanner />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Sidebar
          projects={projects.map(p => ({
            ...p,
            last_active: p.last_active instanceof Date ? p.last_active.toISOString() : (p.last_active ?? undefined),
          }))}
          activeProjectId={activeProjectId}
          isOpen={mobileOpen}
          onClose={closeMobile}
        />
        <main style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>
      </div>

      {showTour && <FirstRunTour onDone={handleTourDone} />}

      <CommandPalette
        open={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        commands={commands}
      />

      <ShortcutsHelp
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      <ShortcutsTooltip />
      <SupportBubble />
    </div>
  );
}
