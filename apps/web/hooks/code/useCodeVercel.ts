import { useCallback, useState } from 'react';
import { useBuildStatus } from '@/hooks/useBuildStatus';
import { API_URL } from './getToken';

export function useCodeVercel(projectId: string, token: string | null) {
  const { activeBuilds, recentDone, startBuild } = useBuildStatus(projectId);
  const [deploying, setDeploying] = useState(false);
  const [deployMessage, setDeployMessage] = useState<string | null>(null);

  const handleDeploy = useCallback(async () => {
    if (deploying || !token) return;
    setDeploying(true);
    setDeployMessage('Deploying to Vercel…');
    await startBuild('vercel_deploy', 'Deploying to Vercel…');
    try {
      const res = await fetch(`${API_URL}/api/deploy/vercel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok || !res.body) throw new Error('Deploy failed');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data:')) continue;
          try {
            const event = JSON.parse(line.slice(5));
            if (event.message) setDeployMessage(event.message);
            if (event.type === 'success') {
              setDeployMessage(`Deployed ✓ ${event.url}`);
              setTimeout(() => setDeployMessage(null), 6000);
            }
            if (event.type === 'error') setDeployMessage(`Error: ${event.message}`);
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      setDeployMessage(err instanceof Error ? err.message : 'Deploy failed');
      setTimeout(() => setDeployMessage(null), 6000);
    } finally { setDeploying(false); }
  }, [deploying, projectId, token, startBuild]);

  return { deploying, deployMessage, handleDeploy, activeBuilds, recentDone };
}
