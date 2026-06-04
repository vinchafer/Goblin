import { useCallback, useState } from 'react';
import { useBuildStatus } from '@/hooks/useBuildStatus';
import { API_URL } from './getToken';

export function useCodeVercel(projectId: string, token: string | null) {
  const { activeBuilds, recentDone, startBuild } = useBuildStatus(projectId);
  const [deploying, setDeploying] = useState(false);
  const [deployMessage, setDeployMessage] = useState<string | null>(null);
  // 10.6-5: surfaced when a deploy is attempted without a Vercel token, so the UI
  // can show the "bring your own Vercel" explainer instead of a raw error.
  const [needsVercel, setNeedsVercel] = useState(false);
  // 10.9-6 — 'public' = Goblin made the project public; 'manual' = the team
  // protects deployments and the user must flip one setting once.
  const [protection, setProtection] = useState<'public' | 'manual' | null>(null);

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
              const mode = event.protection === 'manual' ? 'manual' : 'public';
              setProtection(mode);
              setDeployMessage(
                mode === 'manual'
                  ? `Deployed ✓ ${event.url} — Hinweis: Dein Vercel-Team schützt Deployments. Einmalig: Vercel → Settings → Deployment Protection → „Only Preview Deployments".`
                  : `Deployed ✓ ${event.url} · öffentlich erreichbar`,
              );
              setTimeout(() => setDeployMessage(null), mode === 'manual' ? 15000 : 6000);
            }
            if (event.type === 'error') {
              if (typeof event.message === 'string' && event.message.includes('NO_VERCEL_TOKEN')) {
                setNeedsVercel(true);
                setDeployMessage(null);
              } else {
                setDeployMessage(`Error: ${event.message}`);
              }
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      setDeployMessage(err instanceof Error ? err.message : 'Deploy failed');
      setTimeout(() => setDeployMessage(null), 6000);
    } finally { setDeploying(false); }
  }, [deploying, projectId, token, startBuild]);

  return { deploying, deployMessage, handleDeploy, activeBuilds, recentDone, needsVercel, protection, dismissNeedsVercel: () => setNeedsVercel(false) };
}
