"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { WelcomeModal } from "@/components/onboarding/welcome-modal";
import { CommandPalette, useCommandPalette } from "@/components/ui/CommandPalette";
import { ShortcutsHelp } from "@/components/ui/ShortcutsHelp";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useApp } from "@/contexts/app-context";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@goblin/shared/src/schemas";

const ONBOARDED_KEY = 'goblin_onboarded';

interface DashboardShellProps {
  projects: Project[];
  children: React.ReactNode;
  previewUrl?: string | null;
  isFirstLogin?: boolean;
  userName?: string;
}

export function DashboardShell({ projects, children, previewUrl, isFirstLogin, userName }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { activeTab, setActiveTab, injectionCount, setShowNewProjectModal } = useApp();
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

  useEffect(() => {
    if (!isFirstLogin) return;
    const alreadyOnboarded = typeof window !== 'undefined' && localStorage.getItem(ONBOARDED_KEY);
    if (!alreadyOnboarded) setShowWelcome(true);
  }, [isFirstLogin]);

  const handleWelcomeComplete = useCallback(() => {
    setShowWelcome(false);
    if (typeof window !== 'undefined') localStorage.setItem(ONBOARDED_KEY, '1');
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
        previewUrl={previewUrl}
      />
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

      {showWelcome && (
        <WelcomeModal userName={userName} onComplete={handleWelcomeComplete} />
      )}

      <CommandPalette
        open={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        commands={commands}
      />

      <ShortcutsHelp
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}
