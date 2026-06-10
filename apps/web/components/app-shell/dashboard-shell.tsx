"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { TrialBanner } from "@/components/app-shell/trial-banner";
// NOTE (SCREEN_03_V3 §TASK 4): BottomTabBar intentionally NOT rendered.
// A bottom bar collides with the phone typing zone / swipe-up gesture area;
// mobile mode-switching lives in the top header mode-tile instead. File kept
// in repo, just not wired.
import { CommandPalette, useCommandPalette } from "@/components/ui/CommandPalette";
import { ShortcutsHelp } from "@/components/ui/ShortcutsHelp";
import { ShortcutsTooltip } from "@/components/ui/ShortcutsTooltip";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { NewProjectModal } from "@/components/projects/new-project-modal";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { SETTINGS_SECTIONS } from "@/components/settings/sections";
import dynamic from "next/dynamic";
const FirstRunTour = dynamic(() => import("@/components/onboarding/first-run-tour").then(m => m.FirstRunTour), { ssr: false });
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useApp } from "@/contexts/app-context";
import { useDemoMode } from "@/lib/demo/demo-mode-context";
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
  const demoMode = useDemoMode();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [githubMsg, setGithubMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { activeTab, setActiveTab, injectionCount, showNewProjectModal, setShowNewProjectModal, newProjectIdea, setNewProjectIdea, previewUrl: contextPreviewUrl, setShowSettingsSheet, showSettingsSheet, settingsInitialItem, setSettingsInitialItem, chatProjectId } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const on = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const closeSettings = useCallback(() => {
    setShowSettingsSheet(false);
    setSettingsInitialItem(null);
  }, [setShowSettingsSheet, setSettingsInitialItem]);

  // CLEANUP-2: navigating away closes the settings sheet/modal so it can't stay
  // stacked over the destination. Skip the first mount (no spurious close).
  const settingsMountRef = useRef(false);
  useEffect(() => {
    if (!settingsMountRef.current) { settingsMountRef.current = true; return; }
    closeSettings();
  }, [pathname, closeSettings]);

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }, [router]);

  // Project context comes from the URL (/project/[id]/…) first. A project chat,
  // however, lives on the standalone /chat/[id] route with no /project/ segment;
  // there StandaloneChat publishes its owning project via chatProjectId so the
  // header Code·Preview tabs stay live (A.1 / NAVFIX-1). Project-less standalone
  // chats publish null → tabs stay disabled, unchanged.
  const urlProjectId = (() => {
    const match = pathname.match(/\/project\/([^/]+)/);
    return match ? match[1] : undefined;
  })();
  const activeProjectId = urlProjectId ?? (chatProjectId ?? undefined);

  const replayTour = useCallback(() => {
    if (typeof window !== 'undefined') localStorage.removeItem('goblin_tour_done');
    setShowTour(true);
  }, []);

  const commands = useCommandPalette({
    projects: projects.map(p => ({ id: p.id, name: p.name })),
    activeProjectId,
    onNewProject: () => setShowNewProjectModal(true),
    onToggleSidebar: () => setMobileOpen(s => !s),
    onLogout: handleLogout,
    onShortcuts: () => setShortcutsOpen(true),
    onReplayTour: replayTour,
  });

  useKeyboardShortcuts({
    onCommandPalette: () => setCmdPaletteOpen(true),
    onTabChat: () => setActiveTab('chat'),
    onTabCode: () => setActiveTab('code'),
    onTabPreview: () => setActiveTab('preview'),
    onToggleSidebar: () => setMobileOpen(s => !s),
    onSettings: () => setShowSettingsSheet(true),
    onNewProject: () => setShowNewProjectModal(true),
    onShortcutsHelp: () => setShortcutsOpen(true),
    onFocusChat: () => {
      const input = document.querySelector<HTMLElement>('[data-chat-input]');
      input?.focus();
    },
  });

  // Show first-run tour if redirected from onboarding (?tour=1) or fresh account
  useEffect(() => {
    if (demoMode) return; // Sprint 10 §6: never trigger the tour in demo.
    const tourDone = localStorage.getItem('goblin_tour_done');
    if (tourDone) return;

    const fromOnboarding = new URLSearchParams(window.location.search).get('tour') === '1';
    if (fromOnboarding || isFirstLogin) {
      setShowTour(true);
    }
  }, [isFirstLogin, demoMode]);

  const handleTourDone = useCallback(() => {
    setShowTour(false);
    if (typeof window !== 'undefined') localStorage.setItem('goblin_tour_done', '1');
  }, []);

  // WALKFIX-2: deep-link into the NEW settings via ?settings=<sectionId>. The
  // GitHub OAuth return now lands on /dashboard?settings=connectors&github=connected
  // (was the retired English /dashboard/settings/integrations full page). Opens the
  // settings sheet/modal at that section, then strips the param so a back/refresh
  // doesn't reopen it. This is the single entry point that replaces the old pages.
  useEffect(() => {
    if (demoMode) return; // Sprint 10 §6: no settings deep-link / auto-open in demo.
    const params = new URLSearchParams(window.location.search);
    const sec = params.get('settings');
    if (!sec) return;
    if (SETTINGS_SECTIONS.some(s => s.id === sec)) {
      setSettingsInitialItem(sec);
      window.location.hash = sec; // desktop modal reads the hash to land on the section
      setShowSettingsSheet(true);
    }
    params.delete('settings');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WALK3-1: GitHub OAuth return — surface the outcome instead of silently
  // reopening settings. `?github=connected` → success; `?error=github_failed
  // &reason=…` → a real error the founder can act on (e.g. missing_server_
  // credentials → set the Railway secret), not a mysterious "it just refreshed".
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('github') === 'connected';
    const err = params.get('error');
    if (!connected && !(err && err.startsWith('github'))) return;
    if (connected) {
      setGithubMsg({ ok: true, text: 'GitHub verbunden ✓' });
    } else {
      const reason = params.get('reason') || '';
      const human: Record<string, string> = {
        missing_server_credentials: 'Server-Zugangsdaten fehlen (Railway-Env).',
        incorrect_client_credentials: 'Falsches GitHub Client-Secret (Railway-Env).',
        bad_verification_code: 'Code abgelaufen — bitte erneut verbinden.',
        redirect_uri_mismatch: 'Callback-URL stimmt nicht mit der GitHub-App überein.',
        github_oauth_expired: 'Sitzung abgelaufen — bitte erneut verbinden.',
        user_lookup_failed: 'GitHub-Konto konnte nicht gelesen werden.',
      };
      setGithubMsg({ ok: false, text: `GitHub-Verbindung fehlgeschlagen${reason ? `: ${human[reason] ?? reason}` : ''}` });
    }
    params.delete('github'); params.delete('error'); params.delete('reason');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
    const t = setTimeout(() => setGithubMsg(null), 7000);
    return () => clearTimeout(t);
    // run once on mount — the OAuth redirect is a full navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // We are "in a project context" if any /project/[id]/* route. Tabs become
  // navigation when the user is on the overview, real tab-state when on /work.
  const isInWorkspaceRoute = !!activeProjectId && /\/project\/[^/]+\/work/.test(pathname);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => { closeMobile(); }, [pathname, closeMobile]);

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) closeMobile(); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [closeMobile]);

  const activeProjectName = projects.find(p => p.id === activeProjectId)?.name;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--paper)', overflow: 'hidden' }}>
      <Header
        activeTab={activeTab as 'chat' | 'code' | 'preview'}
        onTabChange={tab => {
          // Inside /work, switch tabs in place. On the project overview,
          // tab clicks navigate into the workspace with the right tab.
          if (isInWorkspaceRoute) {
            setActiveTab(tab);
          } else if (activeProjectId) {
            router.push(`/dashboard/project/${activeProjectId}/work?tab=${tab}`);
          } else {
            // Outside any project — Chat tab on dashboard root creates a session.
            if (tab === 'chat') router.push('/dashboard/chat');
          }
        }}
        onMenuToggle={() => setMobileOpen(s => !s)}
        projectName={activeProjectName}
        showTabs
        hasProject={!!activeProjectId}
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

      <SettingsSheet />
      <SettingsModal
        open={showSettingsSheet && isDesktop}
        onClose={closeSettings}
        initialSectionId={settingsInitialItem ?? undefined}
      />

      {/* Global New Project modal — rendered at shell level so the sidebar
          "+ Neues Projekt" works from any dashboard route (B-S6), including
          while Settings is open. initialIdea comes from the "Sag Goblin"
          composer flow (B-S3) via context. */}
      {showNewProjectModal && (
        <NewProjectModal
          onClose={() => { setShowNewProjectModal(false); setNewProjectIdea(''); }}
          initialIdea={newProjectIdea || undefined}
        />
      )}

      {/* WALK3-1: GitHub OAuth outcome toast — replaces the silent "settings just
          reopened" with a legible success / actionable failure. */}
      {githubMsg && (
        <div
          role="status"
          onClick={() => setGithubMsg(null)}
          style={{
            position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)",
            zIndex: 1000, maxWidth: "min(92vw, 460px)", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 16px", borderRadius: 12,
            background: githubMsg.ok ? "var(--brand-green, #1f5c3a)" : "var(--danger, #B0432A)",
            color: "#fff", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 500,
            boxShadow: "0 10px 32px rgba(15,43,30,0.32)",
          }}
        >
          {githubMsg.text}
        </div>
      )}
    </div>
  );
}
