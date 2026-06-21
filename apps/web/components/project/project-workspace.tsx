"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/contexts/app-context";
import { ProjectChatSurface } from "@/components/project/ProjectChatSurface";
import { CodeTab } from "@/components/project/code-tab";
import { ErrorBoundary } from "@/components/error-boundary";

const PreviewTab = dynamic(
  () => import('@/components/preview/preview-tab').then(m => m.PreviewTab),
  { ssr: false }
);

interface ProjectWorkspaceProps {
  projectId: string;
  projectName?: string;
  previewUrl?: string | null;
}

export function ProjectWorkspace({ projectId, projectName, previewUrl }: ProjectWorkspaceProps) {
  const { activeTab, setActiveTab, pendingCodePayload, setPreviewUrl } = useApp();
  const searchParams = useSearchParams();

  useEffect(() => {
    setPreviewUrl(previewUrl ?? null);
  }, [previewUrl, setPreviewUrl]);

  // Land on the tab requested via ?tab= (set by /dashboard/project/[id]
  // overview screen "Open chat" / "Open code" actions). When NO tab is requested
  // (a bare return to the workspace, a soft-nav, or a re-render that drops the
  // query), restore the LAST tab the user had in THIS project instead of snapping
  // back to chat. W2: a build/preview window that "vanished" was usually this reset
  // — the work persists server-side, but the view jumped off the code/preview tab
  // with no way back short of re-opening it. Persisting the tab keeps the window in
  // place across navigation; the per-session deep-link (?session=) still re-opens a
  // specific build from the project hub.
  useEffect(() => {
    const requested = searchParams?.get('tab');
    let next: 'chat' | 'code' | 'preview';
    if (requested === 'code' || requested === 'preview' || requested === 'chat') {
      next = requested;
    } else {
      let restored: string | null = null;
      // sessionStorage = same-tab restore (W2). localStorage mirror =
      // cross-browser-restart resume (F-W2-a): "build today, reopen tomorrow"
      // still lands on the build window, not chat.
      try { restored = sessionStorage.getItem(`goblin:wsTab:${projectId}`); } catch { /* ignore */ }
      if (restored == null) {
        try { restored = localStorage.getItem(`goblin:lastWsTab:${projectId}`); } catch { /* ignore */ }
      }
      next = restored === 'code' || restored === 'preview' ? restored : 'chat';
    }
    setActiveTab(next);
  }, [projectId, searchParams, setActiveTab]);

  // Remember the active tab per project so a later return to the workspace lands on
  // the same surface (the W2 recovery — the build/preview window stays reachable).
  useEffect(() => {
    try { sessionStorage.setItem(`goblin:wsTab:${projectId}`, activeTab); } catch { /* ignore */ }
    // localStorage mirror survives a browser restart so the sidebar smart-resume
    // (F-W2-a) and a later /work return can recover the build window cross-session.
    try { localStorage.setItem(`goblin:lastWsTab:${projectId}`, activeTab); } catch { /* ignore */ }
  }, [projectId, activeTab]);

  if (activeTab === "code") {
    return (
      <ErrorBoundary label="code-tab">
        <CodeTab projectId={projectId} projectName={projectName} pendingCode={pendingCodePayload} />
      </ErrorBoundary>
    );
  }

  if (activeTab === "preview") {
    return (
      <ErrorBoundary label="preview-tab">
        <PreviewTab projectId={projectId} previewUrl={previewUrl} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary label="chat-tab">
      <ProjectChatSurface projectId={projectId} projectName={projectName} />
    </ErrorBoundary>
  );
}
