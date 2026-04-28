"use client";

import dynamic from "next/dynamic";
import { useApp } from "@/contexts/app-context";
import { ChatContainer } from "@/components/chat/chat-container";
import { CodeTab } from "@/components/project/code-tab";

const PreviewTab = dynamic(() => import('@/components/preview/preview-tab').then(m => m.PreviewTab), { ssr: false });

interface ProjectWorkspaceProps {
  projectId: string;
  previewUrl?: string | null;
}

export function ProjectWorkspace({ projectId, previewUrl }: ProjectWorkspaceProps) {
  const { activeTab, pendingCodePayload } = useApp();
  // pendingCodePayload used by code-tab via shared context

  if (activeTab === "code") {
    return <CodeTab projectId={projectId} />;
  }

  if (activeTab === "preview") {
    return <PreviewTab projectId={projectId} previewUrl={previewUrl} />;
  }

  // Default: chat tab
  return <ChatContainer projectId={projectId} />;
}
