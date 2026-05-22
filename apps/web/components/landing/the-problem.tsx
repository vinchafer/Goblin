'use client';
import { Cpu, Lightning, Copy, Browsers, Check } from '@phosphor-icons/react';

const PROBLEMS = [
  {
    Icon: Lightning,
    title: 'Token panic',
    desc: 'Claude Pro locks you out after two hours. You count tokens instead of shipping.',
    fix: 'BYOK — pay providers directly',
  },
  {
    Icon: Cpu,
    title: 'Hardware wall',
    desc: 'Frontier models need 48 GB+ VRAM. Your laptop can’t run them locally.',
    fix: 'Build from any device',
  },
  {
    Icon: Copy,
    title: 'Copy-paste hell',
    desc: 'Chat, copy, switch, paste, find the file. Every. Single. Time.',
    fix: 'One-tap Send to Code',
  },
  {
    Icon: Browsers,
    title: 'IDE overwhelm',
    desc: 'Cursor and VS Code weren’t built for builders who just want to ship fast.',
    fix: 'Focused builder UI',
  },
];

export function TheProblem() {
  return (
    <section
      id="why-goblin"
      style={{
        background: 'var(--moss)',
        padding: '120px 32px',
        position: 'relative',
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64, maxWidth: 660, marginLeft: 'auto', marginRight: 'auto' }}>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#F0CF8A', color: '#0F2A0D',
              padding: '6px 14px', borderRadius: 100,
              fontSize: 11, fontWeight: 700,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              marginBottom: 24,
              fontFamily: 'DM Sans, sans-serif',
              boxShadow: '0 4px 12px -4px rgba(0,0,0,0.30)',
            }}
          >
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: '#0F2A0D' }} />
            The problem
          </div>
          <h2
            style={{
              fontFamily: 'Fraunces, serif',
              fontSize: 'clamp(34px, 4.8vw, 56px)',
              color: '#F7F4ED',
              lineHeight: 1.05,
              letterSpacing: '-0.025em',
              fontWeight: 600,
              margin: '0 0 18px',
            }}
          >
            Building with AI<br />
            <em style={{ fontStyle: 'italic', color: '#E8BF6A', fontWeight: 500 }}>
              shouldn’t feel like this.
            </em>
          </h2>
          <p
            style={{
              fontSize: 18,
              color: '#F7F4ED',
              lineHeight: 1.6,
              fontWeight: 500,
              fontFamily: 'DM Sans, sans-serif',
              margin: 0,
            }}
          >
            Four walls every builder hits. Goblin removes all of them.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 20,
          }}
        >
          {PROBLEMS.map(({ Icon, title, desc, fix }) => (
            <div
              key={title}
              style={{
                background: '#FBF8F1',
                borderRadius: 16,
                padding: '30px 26px',
                display: 'flex', flexDirection: 'column',
                boxShadow:
                  '0 1px 0 rgba(255,255,255,0.5) inset, 0 24px 50px -24px rgba(0,0,0,0.40)',
                border: '1px solid rgba(45,74,43,0.06)',
              }}
            >
              <div
                style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: '#1f3a1d',
                  color: '#E8BF6A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 22,
                  boxShadow: '0 6px 16px -6px rgba(31,58,29,0.40)',
                }}
              >
                <Icon size={22} weight="bold" />
              </div>
              <div
                style={{
                  fontFamily: 'Fraunces, serif',
                  fontSize: 22, color: '#1a2e18',
                  fontWeight: 700, marginBottom: 10,
                  letterSpacing: '-0.018em',
                }}
              >
                {title}
              </div>
              <div
                style={{
                  fontSize: 15,
                  color: '#1F3A1D',
                  lineHeight: 1.6, fontWeight: 500,
                  marginBottom: 22, flex: 1,
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {desc}
              </div>
              <div
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 12.5, fontWeight: 700,
                  color: '#1f3a1d',
                  background: 'rgba(212,167,55,0.18)',
                  border: '1px solid rgba(212,167,55,0.40)',
                  borderRadius: 100, padding: '6px 12px',
                  alignSelf: 'flex-start',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                <Check size={12} weight="bold" /> {fix}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
