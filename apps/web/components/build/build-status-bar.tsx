"use client";

import { useState, useEffect } from 'react';
import type { BuildRun } from '@/hooks/useBuildStatus';

interface BuildStatusBarProps {
  builds: BuildRun[];
}

const TYPE_LABEL: Record<BuildRun['type'], string> = {
  github_push: 'Pushing to GitHub',
  vercel_deploy: 'Deploying to Vercel',
  code_generation: 'Generating project',
};

const TYPE_ICON: Record<BuildRun['type'], string> = {
  github_push: '⬆',
  vercel_deploy: '▲',
  code_generation: '✦',
};

function BuildItem({ build }: { build: BuildRun }) {
  const [visible, setVisible] = useState(true);
  const isDone = build.status === 'done';
  const isFailed = build.status === 'failed';
  const isFinished = isDone || isFailed;

  useEffect(() => {
    if (!isFinished || !build.completed_at) return;
    const elapsed = Date.now() - new Date(build.completed_at).getTime();
    const remaining = Math.max(0, 30_000 - elapsed);
    const timer = setTimeout(() => setVisible(false), remaining);
    return () => clearTimeout(timer);
  }, [isFinished, build.completed_at]);

  if (!visible) return null;

  const isRunning = build.status === 'running' || build.status === 'pending';
  const progress = isRunning ? Math.max(5, build.progress_pct) : 100;
  const barColor = isFailed ? '#b85c3c' : isDone ? '#4a7c3b' : '#D4A94A';

  return (
    <div style={{
      padding: '10px 14px',
      background: 'var(--panel)',
      border: `1px solid ${isFailed ? 'rgba(184,92,60,0.3)' : isDone ? 'rgba(74,124,59,0.3)' : 'rgba(212,169,74,0.25)'}`,
      borderRadius: 10,
      transition: 'opacity 0.5s',
      opacity: visible ? 1 : 0,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: barColor, flexShrink: 0 }}>
          {TYPE_ICON[build.type]}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', flex: 1 }}>
          {build.message ?? TYPE_LABEL[build.type]}
        </span>
        {isDone && (
          <span style={{ fontSize: 11, color: '#4a7c3b', fontWeight: 600 }}>✓ Done</span>
        )}
        {isFailed && (
          <span style={{ fontSize: 11, color: '#b85c3c', fontWeight: 600 }}>✗ Failed</span>
        )}
        {isRunning && (
          <span style={{ fontSize: 11, color: 'var(--meta)' }}>
            {build.progress_pct}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: barColor,
          borderRadius: 2,
          transition: isRunning ? 'width 0.4s ease' : 'none',
          animation: isRunning && build.progress_pct === 0 ? 'indeterminate 1.5s ease-in-out infinite' : undefined,
        }} />
      </div>

      <style>{`
        @keyframes indeterminate {
          0% { transform: translateX(-100%); width: 40%; }
          100% { transform: translateX(350%); width: 40%; }
        }
      `}</style>
    </div>
  );
}

export function BuildStatusBar({ builds }: BuildStatusBarProps) {
  if (builds.length === 0) return null;

  return (
    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {builds.map(b => <BuildItem key={b.id} build={b} />)}
    </div>
  );
}
