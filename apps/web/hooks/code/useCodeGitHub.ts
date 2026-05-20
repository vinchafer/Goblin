import { useCallback, useState } from 'react';
import { API_URL, getToken } from './getToken';

export function useCodeGitHub(token: string | null) {
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [connectGitHubOpen, setConnectGitHubOpen] = useState(false);
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);

  const openPushModal = useCallback(async () => {
    const t = token ?? await getToken();
    if (!t) return;
    if (githubConnected === null) {
      try {
        const res = await fetch(`${API_URL}/api/github/status`, { headers: { Authorization: `Bearer ${t}` } });
        const data = await res.json();
        setGithubConnected(data.connected);
        if (data.connected) setPushModalOpen(true); else setConnectGitHubOpen(true);
      } catch { setConnectGitHubOpen(true); }
    } else {
      if (githubConnected) setPushModalOpen(true); else setConnectGitHubOpen(true);
    }
  }, [githubConnected, token]);

  return {
    pushModalOpen, setPushModalOpen,
    connectGitHubOpen, setConnectGitHubOpen,
    githubConnected,
    openPushModal,
  };
}
