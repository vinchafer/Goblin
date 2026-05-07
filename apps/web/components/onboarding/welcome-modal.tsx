"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/app-context';

interface WelcomeModalProps {
  userName?: string;
  onComplete: () => void;
}

function GoblinIcon({ size = 72, animate = false }: { size?: number; animate?: boolean }) {
  return (
    <div style={{
      fontSize: size,
      lineHeight: 1,
      display: 'inline-block',
      animation: animate ? 'goblin-wobble 2.4s ease-in-out infinite' : undefined,
      userSelect: 'none',
    }}>
      👺
    </div>
  );
}

function SendToCodeMockup() {
  return (
    <div style={{
      background: '#0f1a0d', borderRadius: 12,
      border: '1px solid #2d4a2b', padding: 16,
      fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
      color: '#8aaa85', maxWidth: 360, margin: '0 auto',
    }}>
      {/* AI message */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#4a6a4a', marginBottom: 5, fontFamily: 'DM Sans, sans-serif' }}>
          Goblin
        </div>
        <div style={{ color: '#c5d0c0', fontFamily: 'DM Sans, sans-serif', fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}>
          Hier ist deine Login-Seite mit Supabase Auth:
        </div>
        {/* Code block */}
        <div style={{
          background: '#141a12', borderRadius: 8,
          border: '1px solid #1e2a1c', padding: 10,
          fontSize: 11,
        }}>
          <div style={{ color: '#4a8a6a' }}>{'// auth.tsx'}</div>
          <div><span style={{ color: '#6aaa8a' }}>export</span><span style={{ color: '#8aaa85' }}> function Login() {'{'}</span></div>
          <div style={{ paddingLeft: 16, color: '#8aaa85' }}>{'return <form>…</form>'}</div>
          <div style={{ color: '#8aaa85' }}>{'}'}</div>
        </div>
        {/* Send to Code button */}
        <button style={{
          marginTop: 8,
          background: 'rgba(212,169,74,0.15)',
          border: '1px solid rgba(212,169,74,0.4)',
          borderRadius: 6, padding: '5px 12px',
          fontSize: 12, color: '#D4A94A',
          cursor: 'default', fontFamily: 'DM Sans, sans-serif',
          display: 'inline-flex', alignItems: 'center', gap: 5,
          animation: 'send-pulse 2s ease-in-out infinite',
        }}>
          ✦ Send to Code →
        </button>
      </div>
    </div>
  );
}

const DOTS = [0, 1, 2];

export function WelcomeModal({ userName, onComplete }: WelcomeModalProps) {
  const router = useRouter();
  const { setShowNewProjectModal } = useApp();
  const [slide, setSlide] = useState(0);

  const firstName = userName?.split(' ')[0] ?? null;

  const handleApiKeys = () => {
    onComplete();
    router.push('/dashboard/settings/keys');
  };

  const handleTryNow = () => {
    onComplete();
    setShowNewProjectModal(true);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <style>{`
        @keyframes goblin-wobble {
          0%,100% { transform: rotate(0deg) scale(1); }
          15%      { transform: rotate(-8deg) scale(1.05); }
          35%      { transform: rotate(6deg) scale(1.02); }
          55%      { transform: rotate(-4deg) scale(1.04); }
          75%      { transform: rotate(3deg) scale(1.01); }
        }
        @keyframes send-pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.7; transform: scale(1.03); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .welcome-slide { animation: slide-up 0.3s ease-out; }
      `}</style>

      <div style={{
        background: '#1a1a18',
        border: '1px solid rgba(212,169,74,0.2)',
        borderRadius: 20,
        width: '100%', maxWidth: 480,
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, padding: '20px 28px 0', justifyContent: 'center' }}>
          {DOTS.map(i => (
            <div key={i} style={{
              height: 3, borderRadius: 2, flex: 1, maxWidth: 40,
              background: i === slide ? '#D4A94A' : 'rgba(255,255,255,0.15)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        <div className="welcome-slide" key={slide} style={{ padding: '32px 36px 36px', textAlign: 'center' }}>

          {/* ── Slide 0 — Welcome ── */}
          {slide === 0 && (
            <>
              <GoblinIcon size={80} animate />
              <h1 style={{
                fontFamily: 'Fraunces, serif',
                fontSize: 30, fontWeight: 700,
                color: '#D4A94A', letterSpacing: '-0.8px',
                marginTop: 20, marginBottom: 10,
              }}>
                Willkommen{firstName ? `, ${firstName}` : ''} 👺
              </h1>
              <p style={{
                fontSize: 16, color: 'rgba(255,255,255,0.6)',
                fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6, marginBottom: 36,
              }}>
                Dein Cloud-Workshop ist bereit.
              </p>
              <button
                onClick={() => setSlide(1)}
                style={{
                  width: '100%', background: '#2D4A2B', color: '#fff',
                  border: 'none', borderRadius: 12, padding: '14px 0',
                  fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#3A5E38')}
                onMouseLeave={e => (e.currentTarget.style.background = '#2D4A2B')}
              >
                Weiter →
              </button>
            </>
          )}

          {/* ── Slide 1 — Send to Code ── */}
          {slide === 1 && (
            <>
              <h2 style={{
                fontFamily: 'Fraunces, serif',
                fontSize: 26, fontWeight: 700,
                color: '#fff', letterSpacing: '-0.5px',
                marginBottom: 10,
              }}>
                Beschreibe, was du bauen willst.
              </h2>
              <p style={{
                fontSize: 14, color: 'rgba(255,255,255,0.5)',
                fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6, marginBottom: 24,
              }}>
                Goblin schreibt den Code.<br />
                Du tippst <span style={{ color: '#D4A94A', fontWeight: 600 }}>[→ Send to Code]</span>.
              </p>
              <SendToCodeMockup />
              <button
                onClick={() => setSlide(2)}
                style={{
                  width: '100%', marginTop: 28,
                  background: '#2D4A2B', color: '#fff',
                  border: 'none', borderRadius: 12, padding: '14px 0',
                  fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#3A5E38')}
                onMouseLeave={e => (e.currentTarget.style.background = '#2D4A2B')}
              >
                Weiter →
              </button>
            </>
          )}

          {/* ── Slide 2 — API Key ── */}
          {slide === 2 && (
            <>
              <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 20 }}>🔑</div>
              <h2 style={{
                fontFamily: 'Fraunces, serif',
                fontSize: 26, fontWeight: 700,
                color: '#fff', letterSpacing: '-0.5px',
                marginBottom: 10,
              }}>
                Verbinde deinen ersten API Key.
              </h2>
              <p style={{
                fontSize: 14, color: 'rgba(255,255,255,0.5)',
                fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6, marginBottom: 32,
              }}>
                Oder nutze Goblin&apos;s Free-Pool zum Testen.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={handleApiKeys}
                  style={{
                    width: '100%', background: '#D4A94A', color: '#1a0f00',
                    border: 'none', borderRadius: 12, padding: '14px 0',
                    fontSize: 15, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#E8BF6A')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#D4A94A')}
                >
                  🔑 API Key verbinden →
                </button>
                <button
                  onClick={handleTryNow}
                  style={{
                    width: '100%', background: 'transparent', color: 'rgba(255,255,255,0.7)',
                    border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '13px 0',
                    fontSize: 15, fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'); (e.currentTarget.style.color = '#fff'); }}
                  onMouseLeave={e => { (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'); (e.currentTarget.style.color = 'rgba(255,255,255,0.7)'); }}
                >
                  Jetzt ausprobieren →
                </button>
              </div>
            </>
          )}

          {/* Skip */}
          {slide < 2 && (
            <button
              onClick={onComplete}
              style={{
                marginTop: 16, background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.25)', fontSize: 12,
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
            >
              Überspringen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
