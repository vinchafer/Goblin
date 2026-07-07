'use client';

import { useEffect, useRef } from 'react';

const Paper16 = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21.4 11l-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"/></svg>;
const Camera16 = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
const GitHub16 = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3a3 3 0 0 0-1-2.3c3-.3 6-1.5 6-7a5.5 5.5 0 0 0-1.5-3.8 5 5 0 0 0-.1-3.8s-1.2-.3-4 1.5a14 14 0 0 0-7 0c-2.8-1.8-4-1.5-4-1.5a5 5 0 0 0-.1 3.8A5.5 5.5 0 0 0 2 10c0 5.5 3 6.7 6 7a3 3 0 0 0-1 2.3V22"/></svg>;
const Search16 = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const Globe16 = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
const Quote16 = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V8a2 2 0 0 1 2-2h11l5 5v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M16 3v5h5"/><path d="M8 13h8M8 17h5"/></svg>;
const Check14 = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;

export type PlusAction = 'upload-file' | 'screenshot' | 'github' | 'research' | 'websearch' | 'paste-chat';

// F1.4: "Recherche" (deep research) is still not a real capability — stays flag-gated.
const RESEARCH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_WEBSEARCH === 'true';

interface ComposerPlusPopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  onAction: (action: PlusAction) => void;
  websearchOn?: boolean;
  /**
   * F4.3: web search is REAL in agent-eligible chats (Goblin Swift/Forge on a project).
   * Show the honest "Websuche" affordance only there; hidden everywhere else.
   */
  websearchAvailable?: boolean;
}

export function ComposerPlusPopover({ open, onClose, anchorRef, onAction, websearchOn, websearchAvailable }: ComposerPlusPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      if (anchorRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !anchorRef.current) return null;

  const rect = anchorRef.current.getBoundingClientRect();
  const top = rect.top - 8;
  const left = rect.left;

  return (
    <div
      ref={popoverRef}
      data-testid="composer-plus-popover"
      style={{
        position: 'fixed',
        top,
        left,
        transform: 'translateY(-100%)',
        background: 'var(--panel)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-popover)',
        padding: '8px 0',
        minWidth: 240,
        zIndex: 100,
        animation: 'gobPopoverIn 180ms ease',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <PopoverItem icon={<Paper16 />} onClick={() => { onAction('upload-file'); onClose(); }}>Datei oder Foto</PopoverItem>
      <PopoverItem icon={<Camera16 />} onClick={() => { onAction('screenshot'); onClose(); }}>Screenshot</PopoverItem>
      <PopoverItem icon={<Quote16 />} onClick={() => { onAction('paste-chat'); onClose(); }}>Notiz oder Chat einfügen</PopoverItem>
      <PopoverItem icon={<GitHub16 />} onClick={() => { onAction('github'); onClose(); }}>Aus GitHub</PopoverItem>
      {/* F4.3 — Websuche is a REAL affordance in agent-eligible chats (the agent has
          the web_search tool there). Hidden elsewhere, where the model truly can't
          browse. "Recherche" (deep research) remains flag-gated (not built). */}
      {(websearchAvailable || RESEARCH_ENABLED) && <Divider />}
      {RESEARCH_ENABLED && (
        <PopoverItem icon={<Search16 />} onClick={() => { onAction('research'); onClose(); }}>Recherche</PopoverItem>
      )}
      {websearchAvailable && (
        <PopoverItem icon={<Globe16 />} onClick={() => { onAction('websearch'); }} checked={websearchOn}>Websuche</PopoverItem>
      )}

      <style jsx>{`
        @keyframes gobPopoverIn {
          from { opacity: 0; transform: translateY(-100%) scale(0.96); }
          to { opacity: 1; transform: translateY(-100%) scale(1); }
        }
      `}</style>
    </div>
  );
}

function PopoverItem({ icon, children, onClick, checked }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; checked?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '8px 16px',
        minHeight: 36,
        background: checked ? 'color-mix(in srgb, var(--brand-green) 8%, transparent)' : 'transparent',
        border: 'none',
        fontSize: 'var(--t-small-fs)',
        color: 'var(--text)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span style={{ color: 'var(--meta)', display: 'flex' }}>{icon}</span>
      <span style={{ flex: 1 }}>{children}</span>
      {checked && <span style={{ color: 'var(--brand-green)' }}><Check14 /></span>}
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border-hairline)', margin: '8px 0' }} />;
}
