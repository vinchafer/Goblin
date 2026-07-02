"use client";

import { useState } from "react";
import { GithubLogo } from "@phosphor-icons/react";
import { PushToGitHubModal } from "./push-to-github-modal";
import { ConnectGitHubModal } from "./connect-github-modal";

interface PushToGitHubButtonProps {
  projectId: string;
  projectName: string;
  isGitHubConnected: boolean;
}

export function PushToGitHubButton({ projectId, projectName, isGitHubConnected }: PushToGitHubButtonProps) {
  const [pushOpen, setPushOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);

  // D1(b) just-in-time: the FIRST time a user reaches for "push to GitHub"
  // while disconnected, open the connect prompt right here (reusing the
  // existing ConnectGitHubModal) instead of showing a dead, disabled button.
  // Once connected, the same click pushes.
  const handleClick = () => {
    if (isGitHubConnected) setPushOpen(true);
    else setConnectOpen(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
        style={{ backgroundColor: 'var(--ink-1)', color: 'white' }}
      >
        <GithubLogo className="w-4 h-4" />
        {isGitHubConnected ? 'Push to GitHub' : 'Connect GitHub to push'}
      </button>

      <PushToGitHubModal
        open={pushOpen}
        onClose={() => setPushOpen(false)}
        projectId={projectId}
        defaultName={projectName.toLowerCase().replace(/\s+/g, '-')}
      />

      <ConnectGitHubModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnected={() => setConnectOpen(false)}
      />
    </>
  );
}
