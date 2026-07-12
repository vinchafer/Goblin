"use client";

import { useState, useEffect } from 'react';
import type { BuildRun } from '@/hooks/useBuildStatus';
import { useLang, t, type Lang } from '@/lib/use-lang';

interface BuildStatusBarProps {
  builds: BuildRun[];
}

// Fallback labels when a build has no explicit message. Bilingual (D-3): these
// were EN-only while the rest of the app renders in the user's chosen language.
function typeLabel(lang: Lang, type: BuildRun['type']): string {
  switch (type) {
    case 'github_push': return t(lang, 'Wird zu GitHub gesichert', 'Pushing to GitHub');
    case 'vercel_deploy': return t(lang, 'Wird auf Vercel live gestellt', 'Deploying to Vercel');
    case 'code_generation': return t(lang, 'Projekt wird erstellt', 'Generating project');
  }
}

const TYPE_ICON: Record<BuildRun['type'], string> = {
  github_push: '⬆',
  vercel_deploy: '▲',
  code_generation: '✦',
};

function BuildItem({ build }: { build: BuildRun }) {
  const lang = useLang();
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
  const barColor = isFailed ? 'var(--danger)' : isDone ? 'var(--success)' : 'var(--brand-gold)';

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
        <span style={{ fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', flex: 1 }}>
          {build.message ?? typeLabel(lang, build.type)}
        </span>
        {isDone && (
          <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>{t(lang, '✓ Fertig', '✓ Done')}</span>
        )}
        {isFailed && (
          <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>{t(lang, '✗ Fehlgeschlagen', '✗ Failed')}</span>
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
