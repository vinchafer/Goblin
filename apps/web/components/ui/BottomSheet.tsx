'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type SheetSize = 'auto' | 'half' | 'full';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  size?: SheetSize;
  showHandle?: boolean;
  children: React.ReactNode;
  testId?: string;
}

export function BottomSheet({
  open,
  onClose,
  title,
  leftAction,
  rightAction,
  size = 'full',
  showHandle = true,
  children,
  testId,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const heightMap: Record<SheetSize, string> = {
    auto: 'auto',
    half: '50vh',
    full: 'calc(100vh - 48px)',
  };

  const onPointerDown = (e: React.PointerEvent) => {
    startYRef.current = e.clientY;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startYRef.current === 0) return;
    const delta = e.clientY - startYRef.current;
    if (delta > 0) setDragOffset(delta);
  };
  const onPointerUp = () => {
    if (dragOffset > 120) onClose();
    setDragOffset(0);
    startYRef.current = 0;
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      data-testid={testId}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--surface-overlay)',
          backdropFilter: 'blur(2px)',
          animation: 'gobFadeIn 200ms ease',
        }}
      />
      <div
        ref={sheetRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 720,
          height: heightMap[size],
          background: 'var(--cream)',
          borderTopLeftRadius: 'var(--radius-sheet)',
          borderTopRightRadius: 'var(--radius-sheet)',
          boxShadow: 'var(--shadow-sheet)',
          display: 'flex',
          flexDirection: 'column',
          transform: `translateY(${dragOffset}px)`,
          animation: dragOffset === 0 ? 'gobSlideUp 280ms cubic-bezier(0.2, 0.9, 0.3, 1)' : 'none',
          paddingBottom: 'env(safe-area-inset-bottom)',
          touchAction: 'pan-y',
        }}
        onPointerDown={showHandle ? onPointerDown : undefined}
        onPointerMove={showHandle ? onPointerMove : undefined}
        onPointerUp={showHandle ? onPointerUp : undefined}
        onPointerCancel={showHandle ? onPointerUp : undefined}
      >
        {showHandle && (
          <div style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'rgba(0,0,0,0.18)',
            margin: '8px auto 4px',
            flexShrink: 0,
          }} />
        )}

        {(title || leftAction || rightAction) && (
          <header style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px 16px',
            minHeight: 56,
            flexShrink: 0,
          }}>
            <span style={{ minWidth: 40, display: 'flex' }}>{leftAction}</span>
            <span style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 17,
              fontWeight: 600,
              color: 'var(--text)',
              textAlign: 'center',
              flex: 1,
            }}>
              {title}
            </span>
            <span style={{ minWidth: 40, display: 'flex', justifyContent: 'flex-end' }}>
              {rightAction}
            </span>
          </header>
        )}

        <div style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          {children}
        </div>
      </div>

      <style jsx>{`
        @keyframes gobFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes gobSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}

export function SheetCloseButton({ onClick, ariaLabel = 'Schließen' }: { onClick: () => void; ariaLabel?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: 'var(--panel)',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-card)',
        color: 'var(--text)',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

export function SheetBackButton({ onClick, ariaLabel = 'Zurück' }: { onClick: () => void; ariaLabel?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: 'var(--panel)',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-card)',
        color: 'var(--text)',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}

export function SheetCheckButton({ onClick, disabled, ariaLabel = 'Bestätigen' }: { onClick: () => void; disabled?: boolean; ariaLabel?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: disabled ? 'rgba(0,0,0,0.20)' : 'var(--text)',
        color: '#FFFFFF',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </button>
  );
}
