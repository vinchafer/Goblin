'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/contexts/app-context';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '../ui/BottomSheet';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsRow } from '../ui/SettingsRow';
import { useUser } from '@/lib/hooks/useUser';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRoutingMode } from '@/components/app-shell/local-cloud-switch';

// Per v6 TASK 1: the primary nav rows carry NO leading icon (no settings cog,
// no upgrade/help/logout glyphs) — they sit flush-left, label + chevron only,
// uniform padding. Only Routing keeps an icon, because it is a control row
// (not a nav row) and the GitBranch glyph anchors its toggle. §A6 geometry.
const GitBranchIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>;

// Desktop anchored popover — same mechanism as ComposerPlusPopover
// (fixed-position off the trigger rect, click-outside + Escape close, focus
// moved into the menu on open). Mobile uses the BottomSheet instead.
function DesktopMenuPopover({
  open, onClose, anchorRef, children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (anchorRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab' && popRef.current) {
        const f = Array.from(popRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'));
        if (f.length === 0) return;
        const first = f[0]!, last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const t = window.setTimeout(() => {
      popRef.current?.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')?.focus();
    }, 0);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !anchorRef.current) return null;
  const rect = anchorRef.current.getBoundingClientRect();
  const top = rect.bottom + 8;
  const right = Math.max(8, window.innerWidth - rect.right);

  return createPortal(
    <div
      ref={popRef}
      role="menu"
      data-testid="avatar-menu-popover"
      style={{
        position: 'fixed',
        top,
        right,
        width: 240,
        background: 'var(--surface-0)',
        border: '1px solid var(--rule)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-2)',
        padding: 8,
        zIndex: 1000,
        fontFamily: 'var(--font-sans)',
        animation: 'gobAvatarMenuIn 160ms ease',
      }}
    >
      {children}
      <style>{`@keyframes gobAvatarMenuIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>,
    document.body,
  );
}

export function AvatarMenu() {
  const [open, setOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const user = useUser();
  const { signOut } = useAuth();
  const { setShowSettingsSheet } = useApp();
  const router = useRouter();
  const [routingMode, setRoutingMode] = useRoutingMode();
  const initial = (user.fullName?.[0] ?? user.email?.[0] ?? 'V').toUpperCase();

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const on = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const close = () => setOpen(false);

  // Shared menu body — identical items in both shells (no enlargement on
  // desktop; rows are dense at --t-small-fs). Settings opens the settings
  // surface (sheet today; desktop modal once WS4 lands).
  const menuBody = (
    <div style={{ padding: isDesktop ? 0 : '8px 16px 16px', fontFamily: 'var(--font-sans)' }}>
      <SettingsCard flushDivider>
        <SettingsRow dense testId="avatar-menu-settings" label="Einstellungen" onClick={() => { close(); setShowSettingsSheet(true); }} />
        <SettingsRow dense label="Plan upgraden" onClick={() => { close(); router.push('/dashboard/billing'); }} />
        <SettingsRow dense label="Hilfe" onClick={() => { close(); router.push('/help'); }} />
      </SettingsCard>

      <div style={{ marginTop: 8 }}>
        <SettingsCard>
          <SettingsRow
            dense
            icon={<GitBranchIcon />}
            label="Routing"
            rightVariant="toggle"
            value={routingMode === 'local'}
            onChange={(v) => setRoutingMode(v ? 'local' : 'cloud')}
          />
        </SettingsCard>
      </div>

      <div style={{ marginTop: 8 }}>
        <SettingsCard>
          <SettingsRow dense label="Abmelden" labelColor="var(--rust)" rightVariant="none" onClick={() => { close(); void signOut(); }} />
        </SettingsCard>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        data-testid="header-avatar"
        onClick={() => setOpen(o => !o)}
        aria-label="Konto-Menü"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'var(--gold-700)',
          color: '#2a1f0f',
          border: 'none',
          fontSize: 'var(--t-small-fs)',
          fontWeight: 700,
          fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {initial}
      </button>

      {isDesktop ? (
        <DesktopMenuPopover open={open} onClose={close} anchorRef={triggerRef}>
          {menuBody}
        </DesktopMenuPopover>
      ) : (
        <BottomSheet open={open} onClose={close} size="auto" testId="avatar-menu-sheet">
          {menuBody}
        </BottomSheet>
      )}
    </>
  );
}
