'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { BottomSheet, SheetCloseButton } from '../ui/BottomSheet';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsRow } from '../ui/SettingsRow';
import { createClient } from '@/lib/supabase/client';

interface RecentChatRowProps {
  chat: {
    id: string;
    title: string | null;
    updated_at: string;
    pinned?: boolean;
    archived?: boolean;
    project_name?: string | null;
  };
  active?: boolean;
  onNavigate: (id: string) => void;
  onUpdate?: () => void;
}

async function callChatAction(chatId: string, action: string, body?: Record<string, unknown>): Promise<Response> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
  return fetch(`${apiBase}/api/chat-sessions/${chatId}/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const Pin20 = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14l-2-7 2-3H7l2 3-2 7z"/></svg>;
const Edit20 = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>;
const Share20 = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>;
const Folder20 = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
const Archive20 = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="5"/><path d="M4 8v13h16V8M9 12h6"/></svg>;
const Trash20 = ({ color = 'currentColor' }: { color?: string }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>;

function timeAgoShort(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1) return 'gerade';
  if (h < 24) return `vor ${h}h`;
  return `vor ${d}d`;
}

export function RecentChatRow({ chat, active, onNavigate, onUpdate }: RecentChatRowProps) {
  const [contextOpen, setContextOpen] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(chat.title ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const clearTimers = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (hintTimer.current) { clearTimeout(hintTimer.current); hintTimer.current = null; }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    longPressFired.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    setPressing(true);
    const hapticsEnabled = typeof localStorage !== 'undefined' && localStorage.getItem('goblin-haptic') !== 'false';
    hintTimer.current = setTimeout(() => {
      if (hapticsEnabled && navigator.vibrate) navigator.vibrate(8);
    }, 200);
    timer.current = setTimeout(() => {
      longPressFired.current = true;
      if (hapticsEnabled && navigator.vibrate) navigator.vibrate([20, 30, 20]);
      setContextOpen(true);
      setPressing(false);
    }, 500);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!startPos.current) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    if (Math.hypot(dx, dy) > 10) {
      clearTimers();
      setPressing(false);
      startPos.current = null;
    }
  };

  const onPointerUp = () => {
    clearTimers();
    setPressing(false);
    startPos.current = null;
  };

  const onClick = () => {
    if (longPressFired.current) return;
    onNavigate(chat.id);
  };

  const handleDelete = async () => {
    if (!confirm('Chat wirklich löschen?')) return;
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      await fetch(`${apiBase}/api/chat-sessions/${chat.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Chat gelöscht');
      setContextOpen(false);
      onUpdate?.();
    } catch {
      toast.error('Löschen fehlgeschlagen');
    }
  };

  return (
    <>
      <div
        data-testid="recent-chat-row"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px',
          borderRadius: 6,
          cursor: 'pointer',
          marginBottom: 1,
          background: active ? 'rgba(212,169,74,0.1)' : 'transparent',
          borderLeft: active ? '2px solid var(--brand-gold)' : '2px solid transparent',
          transition: 'background 0.15s, transform 0.15s ease',
          userSelect: 'none',
          transform: pressing ? 'scale(0.97)' : 'scale(1)',
          boxShadow: pressing ? '0 2px 12px rgba(0,0,0,0.12)' : 'none',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontSize: 'var(--t-small-fs)',
            color: active ? 'var(--brand-green)' : 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: 'var(--font-sans)',
            fontWeight: active ? 600 : 400,
          }}>
            {chat.title || 'Neuer Chat'}
          </span>
          {chat.project_name && (
            <span style={{
              fontSize: 'var(--t-eyebrow-fs)', color: 'var(--text-faint)',
              background: 'rgba(0,0,0,0.05)', padding: '1px 6px',
              borderRadius: 5, alignSelf: 'flex-start',
              fontFamily: 'var(--font-sans)', maxWidth: '100%',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {chat.project_name}
            </span>
          )}
        </div>
        <span style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--ink-3)', flexShrink: 0 }}>
          {timeAgoShort(chat.updated_at)}
        </span>
      </div>

      <BottomSheet
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        size="auto"
        title={chat.title || 'Neuer Chat'}
        leftAction={<SheetCloseButton onClick={() => setContextOpen(false)} />}
        testId="context-sheet"
      >
        <div style={{ padding: '0 16px 16px' }}>
          <SettingsCard>
            <SettingsRow
              icon={<Pin20 />}
              label={chat.pinned ? 'Anheften entfernen' : 'Anheften'}
              rightVariant="none"
              testId="ctx-pin"
              onClick={async () => {
                setContextOpen(false);
                const r = await callChatAction(chat.id, chat.pinned ? 'unpin' : 'pin');
                if (r.ok) {
                  toast.success(chat.pinned ? 'Anheften entfernt' : 'Angeheftet');
                  onUpdate?.();
                } else {
                  toast.error('Konnte nicht aktualisiert werden');
                }
              }}
            />
            <SettingsRow
              icon={<Edit20 />}
              label="Umbenennen"
              rightVariant="none"
              testId="ctx-rename"
              onClick={() => {
                setRenameValue(chat.title ?? '');
                setRenaming(true);
                setContextOpen(false);
              }}
            />
            <SettingsRow
              icon={<Share20 />}
              label="Weitergeben"
              rightVariant="none"
              testId="ctx-share"
              onClick={async () => {
                setContextOpen(false);
                const r = await callChatAction(chat.id, 'share');
                const data = await r.json().catch(() => ({}));
                if (r.ok && data.url) {
                  try {
                    await navigator.clipboard.writeText(data.url);
                    toast.success('Link kopiert');
                  } catch {
                    toast.success(`Link: ${data.url}`);
                  }
                } else {
                  toast.error('Konnte nicht geteilt werden');
                }
              }}
            />
            <SettingsRow
              icon={<Archive20 />}
              label={chat.archived ? 'Aus Archiv holen' : 'Archivieren'}
              rightVariant="none"
              testId="ctx-archive"
              onClick={async () => {
                setContextOpen(false);
                const r = await callChatAction(chat.id, chat.archived ? 'unarchive' : 'archive');
                if (r.ok) {
                  toast.success(chat.archived ? 'Aus Archiv geholt' : 'Archiviert');
                  onUpdate?.();
                } else {
                  toast.error('Konnte nicht aktualisiert werden');
                }
              }}
            />
          </SettingsCard>
          <div style={{ marginTop: 12 }}>
            <SettingsCard>
              <SettingsRow
                icon={<Trash20 color="var(--rust)" />}
                label="Löschen"
                labelColor="var(--rust)"
                rightVariant="none"
                testId="ctx-delete"
                onClick={handleDelete}
              />
            </SettingsCard>
          </div>
        </div>
      </BottomSheet>

      {renaming && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setRenaming(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--panel)',
              padding: 20,
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: 420,
              fontFamily: 'var(--font-sans)',
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontFamily: 'var(--font-sans)', fontSize: 'var(--t-h3-fs)', lineHeight: 'var(--t-h3-lh)' }}>
              Chat umbenennen
            </h3>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              maxLength={120}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const v = renameValue.trim();
                  if (!v) return;
                  const supabase = createClient();
                  const { data: { session } } = await supabase.auth.getSession();
                  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
                  await fetch(`${apiBase}/api/chat-sessions/${chat.id}`, {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
                    },
                    body: JSON.stringify({ title: v }),
                  });
                  toast.success('Umbenannt');
                  setRenaming(false);
                  onUpdate?.();
                } else if (e.key === 'Escape') {
                  setRenaming(false);
                }
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--div)',
                borderRadius: 8,
                fontSize: 'var(--t-body-fs)',
                background: 'var(--white)',
                color: 'var(--text)',
                marginBottom: 12,
                boxSizing: 'border-box',
                fontFamily: 'var(--font-sans)',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRenaming(false)}
                style={{
                  padding: '8px 14px',
                  background: 'transparent',
                  color: 'var(--text)',
                  border: '1px solid var(--div)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={async () => {
                  const v = renameValue.trim();
                  if (!v) return;
                  const supabase = createClient();
                  const { data: { session } } = await supabase.auth.getSession();
                  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
                  await fetch(`${apiBase}/api/chat-sessions/${chat.id}`, {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
                    },
                    body: JSON.stringify({ title: v }),
                  });
                  toast.success('Umbenannt');
                  setRenaming(false);
                  onUpdate?.();
                }}
                disabled={!renameValue.trim()}
                style={{
                  padding: '8px 14px',
                  background: renameValue.trim() ? 'var(--brand-green)' : 'rgba(0,0,0,0.10)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: renameValue.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
