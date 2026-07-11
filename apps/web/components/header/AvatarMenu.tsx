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
import { useDemoMode } from '@/lib/demo/demo-mode-context';
import { useLang, t } from '@/lib/use-lang';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';

// Per v6 TASK 1: the primary nav rows carry NO leading icon (no settings cog,
// no upgrade/help/logout glyphs) — they sit flush-left, label + chevron only,
// uniform padding.

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
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const user = useUser();
  const demoMode = useDemoMode();
  const { signOut } = useAuth();
  const { setShowSettingsSheet } = useApp();
  const router = useRouter();
  const lang = useLang();
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
        <SettingsRow dense testId="avatar-menu-settings" label={t(lang, 'Einstellungen', 'Settings')} onClick={() => { close(); setShowSettingsSheet(true); }} />
        <SettingsRow dense label={t(lang, 'Plan upgraden', 'Upgrade plan')} onClick={() => { close(); router.push('/dashboard/upgrade'); }} />
        <SettingsRow dense label={t(lang, 'Hilfe', 'Help')} onClick={() => { close(); router.push('/help'); }} />
        <SettingsRow dense testId="avatar-menu-feedback" label={t(lang, 'Feedback', 'Feedback')} onClick={() => { close(); setFeedbackOpen(true); }} />
      </SettingsCard>

      <div style={{ marginTop: 8 }}>
        <SettingsCard>
          <SettingsRow dense label={t(lang, 'Abmelden', 'Sign out')} labelColor="var(--rust)" rightVariant="none" onClick={() => { close(); void signOut(); }} />
        </SettingsCard>
      </div>
    </div>
  );

  return (
    <>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} surface="menu" />
      <button
        ref={triggerRef}
        data-testid="header-avatar"
        onClick={() => { if (!demoMode) setOpen(o => !o); }}
        aria-label={t(lang, 'Konto-Menü', 'Account menu')}
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
