"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type BuildRun = {
  id: string;
  project_id: string;
  type: 'github_push' | 'vercel_deploy' | 'code_generation';
  status: 'pending' | 'running' | 'done' | 'failed';
  progress_pct: number;
  message: string | null;
  created_at: string;
  completed_at: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

async function getToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function useBuildStatus(projectId: string) {
  const [builds, setBuilds] = useState<BuildRun[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBuilds = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/builds/project/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data: BuildRun[] = await res.json();
      setBuilds(data);
    } catch {
      // silent — polling handles transient errors
    }
  }, [projectId]);

  useEffect(() => {
    fetchBuilds();
    pollRef.current = setInterval(fetchBuilds, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchBuilds]);

  const startBuild = useCallback(
    async (type: BuildRun['type'], message?: string): Promise<string | null> => {
      const token = await getToken();
      if (!token) return null;
      try {
        const res = await fetch(`${API_URL}/api/builds/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, type, message }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        fetchBuilds();
        return data.jobId as string;
      } catch {
        return null;
      }
    },
    [projectId, fetchBuilds]
  );

  const activeBuilds = builds.filter(b => b.status === 'pending' || b.status === 'running');
  const recentDone = builds.filter(b => {
    if (b.status !== 'done' && b.status !== 'failed') return false;
    if (!b.completed_at) return false;
    return Date.now() - new Date(b.completed_at).getTime() < 30_000;
  });

  return { builds, activeBuilds, recentDone, startBuild, refetch: fetchBuilds };
}
