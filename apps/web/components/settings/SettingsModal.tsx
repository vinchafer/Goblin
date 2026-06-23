'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft } from 'lucide-react';
import { SETTINGS_SECTIONS, GROUP_LABELS, GROUP_LABELS_EN, GROUP_ORDER, type SettingsSectionDef } from './sections';
import { SheetStackProvider, useSheetStack } from '@/components/ui/SheetStack';
import { useLang, t } from '@/lib/use-lang';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  initialSectionId?: string;
}

const FIRST_ID = SETTINGS_SECTIONS[0]!.id;

export function SettingsModal({ open, onClose, initialSectionId }: SettingsModalProps) {
  const [activeId, setActiveId] = useState(initialSectionId ?? FIRST_ID);
  const modalRef = useRef<HTMLDivElement>(null);
  const lang = useLang();
  const sectionLabel = (s: SettingsSectionDef) => (lang === 'en' ? s.labelEn : s.label);

  // Sync to URL hash on open (#profile etc.) and reset when reopened.
  useEffect(() => {
    if (!open) return;
    const hash = window.location.hash.replace('#', '');
    if (hash && SETTINGS_SECTIONS.some(s => s.id === hash)) setActiveId(hash);
    else setActiveId(initialSectionId ?? FIRST_ID);
  }, [open, initialSectionId]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const prevFocused = document.activeElement as HTMLElement | null;
    const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const t = window.setTimeout(() => {
      modalRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }, 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab' && modalRef.current) {
        const f = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (f.length === 0) return;
        const first = f[0]!, last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
      prevFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const active: SettingsSectionDef = SETTINGS_SECTIONS.find(s => s.id === activeId) ?? SETTINGS_SECTIONS[0]!;
  const ActiveComponent = active.Component;

  const selectSection = (id: string) => {
    setActiveId(id);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `#${id}`);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      data-testid="settings-modal"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(15,43,30,0.5)', animation: 'gobSettingsFade 160ms ease' }}
      />
      <div
        ref={modalRef}
        style={{
          position: 'relative',
          width: 960,
          height: 680,
          maxWidth: 'calc(100vw - 64px)',
          maxHeight: 'calc(100vh - 64px)',
          background: 'var(--surface-0)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-3)',
          display: 'flex',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
          animation: 'gobSettingsIn 200ms cubic-bezier(0.2,0.9,0.3,1)',
        }}
      >
        {/* Left nav */}
        <nav
          style={{
            width: 240, flexShrink: 0, height: '100%',
            background: 'var(--surface-1)', borderRight: '1px solid var(--rule)',
            padding: '20px 0', overflowY: 'auto',
          }}
        >
          <div style={{
            padding: '0 20px', marginBottom: 24,
            fontFamily: 'var(--mono, JetBrains Mono, monospace)',
            fontSize: 'var(--t-eyebrow-fs)', letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--ink-3)',
          }}>
            {t(lang, 'Einstellungen', 'Settings')}
          </div>

          {GROUP_ORDER.map(group => {
            const items = SETTINGS_SECTIONS.filter(s => s.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} style={{ marginBottom: 16 }}>
                <div style={{
                  padding: '0 20px 6px',
                  fontSize: 'var(--t-eyebrow-fs)', fontWeight: 600, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: 'var(--ink-3)',
                }}>
                  {(lang === 'en' ? GROUP_LABELS_EN : GROUP_LABELS)[group]}
                </div>
                {items.map(s => {
                  const isActive = s.id === active.id;
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      onClick={() => selectSection(s.id)}
                      aria-current={isActive ? 'page' : undefined}
                      style={{
                        position: 'relative',
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', height: 40, padding: '8px 20px',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                        background: isActive ? 'var(--green-100)' : 'transparent',
                        color: isActive ? 'var(--green-800)' : 'var(--ink-2)',
                        fontFamily: 'var(--font-sans)', fontSize: 'var(--t-small-fs)',
                        fontWeight: isActive ? 500 : 400,
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface-3)'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {isActive && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--brand-gold)' }} />}
                      <span style={{ display: 'flex', flexShrink: 0 }}><Icon /></span>
                      <span>{sectionLabel(s)}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Right content — wrapped in SheetStackProvider so section pages that
            push sub-pages (ProfilePage → Passwort/2FA/Sessions via useSheetStack)
            have a stack context. Keyed by active.id: switching the left nav
            remounts the provider and resets the stack to the section root. */}
        <SheetStackProvider
          key={active.id}
          rootKey={active.id}
          rootNode={<ActiveComponent />}
          rootTitle={sectionLabel(active)}
        >
          {(current, depth) => (
            <SettingsModalPane
              current={current}
              depth={depth}
              fallbackLabel={sectionLabel(active)}
              onClose={onClose}
            />
          )}
        </SheetStackProvider>
      </div>

      <style>{`
        @keyframes gobSettingsFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gobSettingsIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>,
    document.body,
  );
}

/** Right-hand pane of the desktop Settings modal. Rendered inside
 *  SheetStackProvider, so section pages can push/pop sub-pages and this pane
 *  shows a back affordance when the stack has depth. */
function SettingsModalPane({
  current,
  depth,
  fallbackLabel,
  onClose,
}: {
  current: { key: string; node: React.ReactNode; title?: string };
  depth: number;
  fallbackLabel: string;
  onClose: () => void;
}) {
  const { pop } = useSheetStack();
  const lang = useLang();
  const isSub = depth > 1;
  const title = isSub ? (current.title ?? fallbackLabel) : fallbackLabel;

  return (
    <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{
        height: 56, flexShrink: 0, padding: '16px 24px',
        borderBottom: '1px solid var(--rule)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {isSub && (
            <button
              onClick={pop}
              aria-label={t(lang, 'Zurück', 'Back')}
              style={{
                width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent',
                color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-2)')}
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <span style={{
            fontSize: 'var(--t-h3-fs)', color: 'var(--ink-1)', fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{title}</span>
        </div>
        <button
          onClick={onClose}
          aria-label={t(lang, 'Schließen', 'Close')}
          style={{
            width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent',
            color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-1)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-2)')}
        >
          <X size={20} />
        </button>
      </div>
      <div style={{
        flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '24px 32px',
        // Query container: pilot section components use @container
        // (settings-pane) to apply desktop density. The mobile sheet has no
        // such container, so those rules never match there.
        containerType: 'inline-size',
        containerName: 'settings-pane',
      }}>
        {current.node}
      </div>
    </div>
  );
}
