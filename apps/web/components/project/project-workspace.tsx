"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/contexts/app-context";
import { ChatTab } from "@/components/workspace/chat-tab";
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
  // overview screen "Open chat" / "Open code" actions). Falls back to chat.
  useEffect(() => {
    const requested = searchParams?.get('tab');
    const next: 'chat' | 'code' | 'preview' =
      requested === 'code' || requested === 'preview' ? requested : 'chat';
    setActiveTab(next);
  }, [projectId, searchParams, setActiveTab]);

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
      <ChatTab projectId={projectId} />
    </ErrorBoundary>
  );
}
