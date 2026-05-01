"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useApp } from "@/contexts/app-context";
import { ChatTab } from "@/components/workspace/chat-tab";
import { CodeTab } from "@/components/project/code-tab";

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
  const { activeTab, pendingCodePayload, setPreviewUrl } = useApp();

  useEffect(() => {
    setPreviewUrl(previewUrl ?? null);
  }, [previewUrl, setPreviewUrl]);

  if (activeTab === "code") {
    return <CodeTab projectId={projectId} projectName={projectName} pendingCode={pendingCodePayload} />;
  }

  if (activeTab === "preview") {
    return <PreviewTab projectId={projectId} previewUrl={previewUrl} />;
  }

  return <ChatTab projectId={projectId} />;
}
