'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { apiPost } from '@/lib/api';
import { useLang } from '@/lib/use-lang';
import { manageLabels } from '@/components/manage/labels';
import { ProjectRowMenu } from '@/components/sidebar/ProjectRowMenu';
import { ConfirmDialog } from '@/components/manage/ManageDialogs';
import { GoblinLogo } from '@/components/brand/GoblinLogo';

interface Project {
  id: string;
  name: string;
  color?: string | null;
  last_active?: string | null;
  created_at?: string | null;
}

function timeAgo(d?: string | null): string {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (h < 1) return 'now';
  if (h < 24) return `${h}h`;
  if (day < 30) return `${day}d`;
  return `${Math.floor(day / 30)}mo`;
}

export default function ProjectsOverviewPage() {
  const router = useRouter();
  const lang = useLang();
  const L = manageLabels(lang);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, color, last_active, created_at')
      .eq('user_id', user.id)
      .order('last_active', { ascending: false });
    if (error) console.error('[projects-overview] load failed:', error.message);
    setProjects((data as Project[]) ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allSelected = projects.length > 0 && selected.size === projects.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(projects.map((p) => p.id)));
  const exitSelect = () => { setSelecting(false); setSelected(new Set()); };

  const doBulkDelete = async () => {
    const ids = [...selected];
    try {
      await apiPost('/api/projects/bulk-delete', { ids });
      toast.success(L.deleted);
    } catch {
      toast.error(L.deleteFailed);
    }
    setConfirmBulk(false);
    exitSelect();
    setLoading(true);
    load();
    router.refresh();
  };

  return (
    <div style={{ minHeight: '100%', background: 'var(--paper)', padding: '20px 16px 96px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-dash-display), Manrope, sans-serif', fontSize: 'var(--t-h2-fs)', lineHeight: 'var(--t-h2-lh)', color: 'var(--text)' }}>
            {L.projectsTitle}
          </h1>
          {projects.length > 0 && (
            selecting ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={toggleAll} style={ghost}>{L.selectAll}</button>
                <button onClick={exitSelect} style={ghost}>{L.done}</button>
              </div>
            ) : (
              <button onClick={() => setSelecting(true)} data-testid="select-toggle" style={ghost}>{L.select}</button>
            )
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <GoblinLogo state="thinking" size={32} variant="green" />
          </div>
        ) : projects.length === 0 ? (
          <p style={{ color: 'var(--text-faint)', fontStyle: 'italic', fontFamily: 'var(--font-sans)', fontSize: 'var(--t-small-fs)' }}>{L.noProjects}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {projects.map((p) => {
              const sel = selected.has(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => selecting ? toggle(p.id) : router.push(`/dashboard/project/${p.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    borderRadius: 10, cursor: 'pointer', background: 'var(--panel, #fff)',
                    border: `1px solid ${sel ? 'var(--brand-green)' : 'var(--border)'}`,
                    transition: 'border-color 0.12s, background 0.12s',
                  }}
                >
                  {selecting && <Checkbox checked={sel} />}
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: p.color ?? 'var(--brand-gold)', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-sans)', fontSize: 'var(--t-body-fs)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                  <span style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--ink-3)', fontFamily: 'var(--font-mono, monospace)', flexShrink: 0 }}>
                    {timeAgo(p.last_active ?? p.created_at)}
                  </span>
                  {!selecting && <ProjectRowMenu project={{ id: p.id, name: p.name }} onChanged={load} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selecting && selected.size > 0 && (
        <div style={bulkBar} data-testid="bulk-bar">
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--t-small-fs)', color: 'var(--bone, #F4ECD8)' }}>
            {L.selectedCount(selected.size)}
          </span>
          <button onClick={() => setConfirmBulk(true)} data-testid="bulk-delete" style={bulkDangerBtn}>{L.delete}</button>
        </div>
      )}

      <ConfirmDialog
        open={confirmBulk}
        title={L.bulkDeleteProjectsTitle(selected.size)}
        body={L.bulkDeleteProjectsBody}
        confirmLabel={L.delete}
        cancelLabel={L.cancel}
        onConfirm={doBulkDelete}
        onClose={() => setConfirmBulk(false)}
      />
    </div>
  );
}

const ghost: React.CSSProperties = {
  padding: '6px 12px', background: 'transparent', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
  fontFamily: 'var(--font-sans)', fontSize: 'var(--t-small-fs)',
};
const bulkBar: React.CSSProperties = {
  position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)',
  display: 'flex', alignItems: 'center', gap: 16, padding: '10px 16px',
  background: 'var(--brand-green)', borderRadius: 999, zIndex: 60,
  boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
};
const bulkDangerBtn: React.CSSProperties = {
  padding: '7px 14px', background: 'var(--rust, #B4451F)', color: '#fff',
  border: 'none', borderRadius: 999, cursor: 'pointer', fontWeight: 600,
  fontFamily: 'var(--font-sans)', fontSize: 'var(--t-small-fs)',
};

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span style={{
      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
      border: `1.6px solid ${checked ? 'var(--brand-green)' : 'var(--border)'}`,
      background: checked ? 'var(--brand-green)' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {checked && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  );
}
