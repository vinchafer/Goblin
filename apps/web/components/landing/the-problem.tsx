'use client';
import { Cpu, Lightning, Copy, Browsers, Check } from '@phosphor-icons/react';

const PROBLEMS = [
  {
    Icon: Lightning,
    title: 'Token panic',
    desc: 'Claude Pro locks you out after 2 hours. You end up counting tokens instead of shipping.',
    fix: 'BYOK — pay your provider directly',
  },
  {
    Icon: Cpu,
    title: 'Hardware wall',
    desc: 'Powerful models need 48GB+ VRAM. Your laptop cannot run them locally.',
    fix: 'Build from phone, tablet, or any device',
  },
  {
    Icon: Copy,
    title: 'Copy-paste hell',
    desc: 'Chat, copy, switch tabs, paste, find the right file. Every. Single. Time.',
    fix: 'One-tap Send to Code',
  },
  {
    Icon: Browsers,
    title: 'IDE overwhelm',
    desc: 'Cursor and VS Code were not built for builders who just want to ship fast.',
    fix: 'Focused builder UI',
  },
];

export function TheProblem() {
  return (
    <section id="why-goblin" style={{ background: 'var(--moss)', padding: '100px 40px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 72 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.16em',
            textTransform: 'uppercase' as const, color: 'var(--ochre)',
            marginBottom: 18, fontFamily: 'DM Sans, sans-serif',
          }}>The problem</div>
          <h2 style={{
            fontFamily: 'Fraunces, serif',
            fontSize: 'clamp(32px, 5vw, 48px)',
            color: 'var(--cream)',
            lineHeight: 1.1,
            letterSpacing: '-1.5px',
            fontWeight: 700,
            marginBottom: 16,
          }}>
            Building with AI<br />should not feel like this.
          </h2>
          <p style={{
            fontSize: 17, color: 'rgba(247,244,237,0.72)',
            maxWidth: 520, margin: '0 auto', lineHeight: 1.6,
            fontWeight: 400, fontFamily: 'DM Sans, sans-serif',
          }}>
            Four walls every builder hits. Goblin removes all of them.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 24,
        }}>
          {PROBLEMS.map(({ Icon, title, desc, fix }) => (
            <div
              key={title}
              style={{
                background: 'var(--cream)',
                border: '1px solid rgba(0,0,0,0.04)',
                borderRadius: 16,
                padding: '32px 26px 28px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 12px 24px -16px rgba(0,0,0,0.20)',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(45, 74, 43, 0.08)',
                color: 'var(--moss)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 22,
              }}>
                <Icon size={22} weight="bold" />
              </div>
              <div style={{
                fontFamily: 'Fraunces, serif',
                fontSize: 20, color: 'var(--bark)',
                fontWeight: 700, marginBottom: 8, letterSpacing: '-0.3px',
              }}>
                {title}
              </div>
              <div style={{
                fontSize: 14, color: 'var(--meta, #6B655A)',
                lineHeight: 1.6, fontWeight: 400, marginBottom: 22,
                flex: 1, fontFamily: 'DM Sans, sans-serif',
              }}>
                {desc}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 600,
                color: 'var(--moss)',
                background: 'rgba(45, 74, 43, 0.08)',
                border: '1px solid rgba(45, 74, 43, 0.16)',
                borderRadius: 100, padding: '5px 12px',
                alignSelf: 'flex-start',
                fontFamily: 'DM Sans, sans-serif',
              }}>
                <Check size={12} weight="bold" /> {fix}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
