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
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--ochre)', marginBottom: 16, fontFamily: 'DM Sans, sans-serif' }}>The problem</div>
          <h2 style={{
            fontFamily: 'Fraunces, serif', fontSize: 'clamp(32px, 5vw, 48px)',
            color: 'var(--cream)', lineHeight: 1.1, letterSpacing: '-1.5px', fontWeight: 700, marginBottom: 16,
          }}>
            Building with AI<br />should not feel like this.
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 480, margin: '0 auto', lineHeight: 1.65, fontWeight: 400, fontFamily: 'DM Sans, sans-serif' }}>
            Four walls every builder hits. Goblin removes all of them.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 20 }}>
          {PROBLEMS.map(({ Icon, title, desc, fix }) => (
            <div key={title} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '28px 24px', display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ color: 'var(--ochre)', marginBottom: 18, opacity: 0.9 }}>
                <Icon size={28} weight="duotone" />
              </div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 19, color: 'var(--cream)', fontWeight: 700, marginBottom: 8, letterSpacing: '-0.3px' }}>{title}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.65, fontWeight: 400, marginBottom: 20, flex: 1, fontFamily: 'DM Sans, sans-serif' }}>{desc}</div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 500,
                color: 'var(--ochre)', background: 'rgba(201,147,58,0.1)', border: '1px solid rgba(201,147,58,0.2)',
                borderRadius: 100, padding: '4px 12px', alignSelf: 'flex-start', fontFamily: 'DM Sans, sans-serif',
              }}>
                <Check size={11} weight="bold" /> {fix}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
