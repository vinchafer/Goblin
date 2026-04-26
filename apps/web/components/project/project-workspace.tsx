"use client";

import { useApp } from "@/contexts/app-context";
import { ChatContainer } from "@/components/chat/chat-container";
import { CodeTab } from "@/components/project/code-tab";

interface ProjectWorkspaceProps {
  projectId: string;
}

export function ProjectWorkspace({ projectId }: ProjectWorkspaceProps) {
  const { activeTab } = useApp();

  if (activeTab === "code") {
    return <CodeTab projectId={projectId} />;
  }

  // Default: chat tab
  return <ChatContainer projectId={projectId} />;
}