"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useApp } from "@/contexts/app-context";
import { ChatTab } from "@/components/workspace/chat-tab";
import { CodeTab } from "@/components/project/code-tab";
import type { ChatMessage } from "@goblin/shared/src/schemas";

const PreviewTab = dynamic(() => import('@/components/preview/preview-tab').then(m => m.PreviewTab), { ssr: false });

interface ProjectWorkspaceProps {
  projectId: string;
  previewUrl?: string | null;
}

export function ProjectWorkspace({ projectId, previewUrl }: ProjectWorkspaceProps) {
  const { activeTab, pendingCodePayload } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  if (activeTab === "code") {
    return <CodeTab projectId={projectId} pendingCode={pendingCodePayload} />;
  }

  if (activeTab === "preview") {
    return <PreviewTab projectId={projectId} previewUrl={previewUrl} />;
  }

  // Default: chat tab
  return (
    <ChatTab 
      projectId={projectId}
      messages={messages}
      onMessagesChange={setMessages}
    />
  );
}
