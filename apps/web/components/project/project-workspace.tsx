"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
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

  useEffect(() => {
    setPreviewUrl(previewUrl ?? null);
  }, [previewUrl, setPreviewUrl]);

  // Always land on chat when navigating to a project
  useEffect(() => {
    setActiveTab('chat');
  }, [projectId, setActiveTab]);

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
