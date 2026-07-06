'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { useLang } from '@/lib/use-lang';
import { manageLabels } from '@/components/manage/labels';
import { KebabMenu } from '@/components/manage/KebabMenu';
import { ConfirmDialog, RenameDialog, MoveDialog } from '@/components/manage/ManageDialogs';
import { GoblinLogo } from '@/components/brand/GoblinLogo';

interface Chat {
  id: string;
  title: string | null;
  updated_at: string;
  project_id?: string | null;
  project_name?: string | null;
}
interface ProjectLite { id: string; name: string }

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

export default function ChatsOverviewPage() {
  const router = useRouter();
  const lang = useLang();
  const L = manageLabels(lang);
  const [chats, setChats] = useState<Chat[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkMoving, setBulkMoving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const [{ data: projData }, chatData] = await Promise.all([
      supabase.from('projects').select('id, name').eq('user_id', user.id).order('last_active', { ascending: false }),
      apiGet<Chat[]>('/api/chat-sessions').catch(() => [] as Chat[]),
    ]);
    setProjects((projData as ProjectLite[]) ?? []);
    setChats(chatData);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allSelected = chats.length > 0 && selected.size === chats.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(chats.map((c) => c.id)));
  const exitSelect = () => { setSelecting(false); setSelected(new Set()); };

  const doBulkDelete = async () => {
    try { await apiPost('/api/chat-sessions/bulk-delete', { ids: [...selected] }); toast.success(L.deleted); }
    catch { toast.error(L.deleteFailed); }
    setConfirmBulk(false); exitSelect(); setLoading(true); load();
  };
  const doBulkMove = async (projectId: string | null) => {
    try { await apiPost('/api/chat-sessions/bulk-move', { ids: [...selected], projectId }); toast.success(L.moved); }
    catch { toast.error(L.moveFailed); }
    setBulkMoving(false); exitSelect(); setLoading(true); load();
  };

  return (
    <div style={{ minHeight: '100%', background: 'var(--surface-page)', padding: '20px 16px 96px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-dash-display), Manrope, sans-serif', fontSize: 'var(--t-h2-fs)', lineHeight: 'var(--t-h2-lh)', color: 'var(--text)' }}>
            {L.chatsTitle}
          </h1>
          {chats.length > 0 && (
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
        ) : chats.length === 0 ? (
          <p style={{ color: 'var(--text-faint)', fontStyle: 'italic', fontFamily: 'var(--font-sans)', fontSize: 'var(--t-small-fs)' }}>{L.noChats}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {chats.map((c) => (
              <ChatRow
                key={c.id}
                chat={c}
                projects={projects}
                selecting={selecting}
                selected={selected.has(c.id)}
                onToggle={() => toggle(c.id)}
                onOpen={() => router.push(`/dashboard/chat/${c.id}`)}
                onChanged={load}
                L={L}
              />
            ))}
          </div>
        )}
      </div>

      {selecting && selected.size > 0 && (
        <div style={bulkBar} data-testid="bulk-bar">
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--t-small-fs)', color: 'var(--bone, #F4ECD8)' }}>
            {L.selectedCount(selected.size)}
          </span>
          <button onClick={() => setBulkMoving(true)} data-testid="bulk-move" style={bulkGhostBtn}>{L.move}</button>
          <button onClick={() => setConfirmBulk(true)} data-testid="bulk-delete" style={bulkDangerBtn}>{L.delete}</button>
        </div>
      )}

      <ConfirmDialog
        open={confirmBulk}
        title={L.bulkDeleteChatsTitle(selected.size)}
        body={L.bulkDeleteChatsBody}
        confirmLabel={L.delete}
        cancelLabel={L.cancel}
        onConfirm={doBulkDelete}
        onClose={() => setConfirmBulk(false)}
      />
      <MoveDialog
        open={bulkMoving}
        title={L.moveTitle}
        projects={projects}
        noProjectLabel={L.noProject}
        cancelLabel={L.cancel}
        onSelect={doBulkMove}
        onClose={() => setBulkMoving(false)}
      />
    </div>
  );
}

function ChatRow({ chat, projects, selecting, selected, onToggle, onOpen, onChanged, L }: {
  chat: Chat; projects: ProjectLite[]; selecting: boolean; selected: boolean;
  onToggle: () => void; onOpen: () => void; onChanged: () => void;
  L: ReturnType<typeof manageLabels>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const doRename = async (title: string) => {
    setRenaming(false);
    try { await apiPatch(`/api/chat-sessions/${chat.id}`, { title }); toast.success(L.renamed); onChanged(); }
    catch { toast.error(L.renameFailed); }
  };
  const doMove = async (projectId: string | null) => {
    setMoving(false);
    try { await apiPatch(`/api/chat-sessions/${chat.id}/move`, { projectId }); toast.success(L.moved); onChanged(); }
    catch { toast.error(L.moveFailed); }
  };
  const doDelete = async () => {
    try { await apiDelete(`/api/chat-sessions/${chat.id}`); toast.success(L.deleted); setDeleting(false); onChanged(); }
    catch { toast.error(L.deleteFailed); setDeleting(false); }
  };

  return (
    <div
      onClick={() => selecting ? onToggle() : onOpen()}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
        borderRadius: 10, cursor: 'pointer', background: 'var(--panel, #fff)',
        border: `1px solid ${selected ? 'var(--brand-green)' : 'var(--border)'}`,
        transition: 'border-color 0.12s',
      }}
    >
      {selecting && <Checkbox checked={selected} />}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--t-body-fs)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {chat.title || 'Neuer Chat'}
        </span>
        <span style={{
          fontSize: 'var(--t-eyebrow-fs)', color: 'var(--text-faint)',
          background: 'rgba(0,0,0,0.05)', padding: '1px 6px', borderRadius: 5,
          alignSelf: 'flex-start', fontFamily: 'var(--font-sans)', maxWidth: '100%',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {chat.project_name ?? L.noProject}
        </span>
      </div>
      <span style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--ink-3)', fontFamily: 'var(--font-mono, monospace)', flexShrink: 0 }}>
        {timeAgo(chat.updated_at)}
      </span>
      {!selecting && (
        <KebabMenu
          ariaLabel={L.more}
          testId="chat-kebab"
          items={[
            { label: L.rename, onClick: () => setRenaming(true) },
            { label: L.move, onClick: () => setMoving(true) },
            { label: L.delete, danger: true, onClick: () => setDeleting(true) },
          ]}
        />
      )}

      <RenameDialog open={renaming} title={L.renameChatTitle} initialValue={chat.title ?? ''} placeholder={L.namePlaceholder} saveLabel={L.save} cancelLabel={L.cancel} onSave={doRename} onClose={() => setRenaming(false)} />
      <MoveDialog open={moving} title={L.moveTitle} projects={projects} currentProjectId={chat.project_id ?? null} noProjectLabel={L.noProject} cancelLabel={L.cancel} onSelect={doMove} onClose={() => setMoving(false)} />
      <ConfirmDialog open={deleting} title={L.deleteChatTitle} body={L.deleteChatBody} confirmLabel={L.delete} cancelLabel={L.cancel} onConfirm={doDelete} onClose={() => setDeleting(false)} />
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
  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
  background: 'var(--brand-green)', borderRadius: 999, zIndex: 60,
  boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
};
const bulkDangerBtn: React.CSSProperties = {
  padding: '7px 14px', background: 'var(--rust, #B4451F)', color: '#fff',
  border: 'none', borderRadius: 999, cursor: 'pointer', fontWeight: 600,
  fontFamily: 'var(--font-sans)', fontSize: 'var(--t-small-fs)',
};
const bulkGhostBtn: React.CSSProperties = {
  padding: '7px 14px', background: 'rgba(255,255,255,0.15)', color: 'var(--bone, #F4ECD8)',
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
