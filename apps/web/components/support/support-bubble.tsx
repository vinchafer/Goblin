'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { SupportChat } from './support-chat';

export function SupportBubble() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Only show in dashboard routes
  if (!pathname.startsWith('/dashboard')) return null;

  return (
    <>
      {/* Chat panel */}
      {open && (
        <>
          {/* Mobile backdrop */}
          <div
            className="support-backdrop"
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 899 }}
          />
          <div
            className="support-panel"
            style={{
              position: 'fixed',
              bottom: 84, right: 20,
              width: 360, height: 520,
              background: 'var(--paper)',
              borderRadius: 16,
              border: '1px solid #E8E4DC',
              boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
              zIndex: 900,
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <SupportChat onClose={() => setOpen(false)} />
          </div>
        </>
      )}

      {/* Bubble button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        aria-label={open ? 'Close support' : 'Open support'}
        style={{
          position: 'fixed',
          bottom: 20, right: 20,
          width: 54, height: 54,
          borderRadius: '50%',
          background: open ? '#1a2e18' : 'var(--brand-green)',
          border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(45,74,43,0.4)',
          zIndex: 901,
          transition: 'transform 0.2s, background 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-gold)" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 700, color: 'var(--brand-gold)', lineHeight: 1 }}>?</span>
        )}
      </button>

      <style>{`
        @media (max-width: 768px) {
          .support-panel {
            bottom: 0 !important; right: 0 !important; left: 0 !important;
            width: 100% !important; height: 75dvh !important;
            border-radius: 18px 18px 0 0 !important;
          }
        }
      `}</style>
    </>
  );
}
