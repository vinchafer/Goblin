"use client";

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
  previewUrl?: string | null;
}

export function ProjectWorkspace({ projectId, previewUrl }: ProjectWorkspaceProps) {
  const { activeTab, pendingCodePayload } = useApp();

  if (activeTab === "code") {
    return <CodeTab projectId={projectId} pendingCode={pendingCodePayload} />;
  }

  if (activeTab === "preview") {
    return <PreviewTab projectId={projectId} previewUrl={previewUrl} />;
  }

  return <ChatTab projectId={projectId} />;
}
