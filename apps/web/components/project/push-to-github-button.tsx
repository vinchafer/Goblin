"use client";

import { useState } from "react";
import { GithubLogo } from "@phosphor-icons/react";
import { PushToGitHubModal } from "./push-to-github-modal";

interface PushToGitHubButtonProps {
  projectId: string;
  projectName: string;
  isGitHubConnected: boolean;
}

export function PushToGitHubButton({ projectId, projectName, isGitHubConnected }: PushToGitHubButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        disabled={!isGitHubConnected}
        className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        style={{ backgroundColor: 'var(--ink-1)', color: 'white' }}
      >
        <GithubLogo className="w-4 h-4" />
        {isGitHubConnected ? 'Push to GitHub' : 'Connect GitHub first'}
      </button>

      <PushToGitHubModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        projectId={projectId}
        defaultName={projectName.toLowerCase().replace(/\s+/g, '-')}
      />
    </>
  );
}