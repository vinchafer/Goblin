'use client';
import { useState } from 'react';

export function SendToCodeDemo() {
  const [status, setStatus] = useState<'idle'|'sending'|'sent'>('idle');
  const handle = () => {
    if (status !== 'idle') return;
    setStatus('sending');
    setTimeout(() => { setStatus('sent'); setTimeout(() => setStatus('idle'), 4000); }, 700);
  };
  return (
    <section style={{ background: 'var(--cream)', padding: '100px 40px' }}>
      <div style={{ textAlign: 'center', marginBottom: 64 }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase' as const, color: 'var(--ochre)', marginBottom: 16 }}>Core feature</div>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 'clamp(36px,5vw,56px)', color: 'var(--moss)', lineHeight: 1.05, letterSpacing: '-2px', fontWeight: 900, marginBottom: 16 }}>
          No more copy-paste.
        </h2>
        <p style={{ fontSize: 16, color: 'var(--meta)', maxWidth: 460, margin: '0 auto', lineHeight: 1.6, fontWeight: 300 }}>
          One tap sends AI code directly to your editor. No clipboard. No switching tabs.
        </p>
      </div>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderRadius: 16, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.07)' }}>
        <div style={{ background: '#fff', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'var(--moss)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'Fraunces, serif', color: 'var(--ochre)', fontSize: 15, fontWeight: 700 }}>Goblin Chat</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', background: 'rgba(201,147,58,0.15)', border: '1px solid rgba(201,147,58,0.4)', color: '#e8b05a', padding: '2px 8px', borderRadius: 20 }}>claude-sonnet-4-6</span>
          </div>
          <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ alignSelf: 'flex-end', background: 'var(--moss)', color: 'rgba(255,255,255,0.9)', borderRadius: 10, padding: '9px 14px', fontSize: 13, maxWidth: '85%' }}>
              Add a dark mode toggle to the navbar
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--moss)', color: 'var(--ochre)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>G</div>
              <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
                Done! Here is the updated Navbar:
                <div style={{ background: '#1a2018', borderRadius: 8, padding: '10px 12px', margin: '8px 0 8px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#8aaa85', lineHeight: 1.7 }}>
                  <span style={{ color: '#c9933a' }}>export function</span> <span style={{ color: '#7dd3a8' }}>Navbar</span>() {'{'}<br />
                  &nbsp;&nbsp;<span style={{ color: '#c9933a' }}>const</span> [dark, setDark] = useState(false)<br />
                  &nbsp;&nbsp;<span style={{ color: '#c9933a' }}>const</span> toggle = () =&gt; setDark(d =&gt; !d)<br />
                  &nbsp;&nbsp;<span style={{ color: '#c9933a' }}>return</span> &lt;<span style={{ color: '#7dd3a8' }}>nav</span>&gt;...&lt;/<span style={{ color: '#7dd3a8' }}>nav</span>&gt;<br />
                  {'}'}
                </div>
                <button onClick={handle} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: status === 'sent' ? '#4a7c3b' : 'var(--ochre)',
                  color: status === 'sent' ? '#fff' : 'var(--bark)',
                  border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(201,147,58,0.25)',
                }}>
                  {status === 'idle' && '→ Send to Code'}
                  {status === 'sending' && '⟳ Sending…'}
                  {status === 'sent' && '✓ Sent to Code'}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div style={{ background: '#141a12', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#0f1410', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #1e2a1c' }}>
            <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', padding: '3px 10px', borderRadius: 4, background: '#1e2a1c', color: '#7aaa75', border: '1px solid #2d4a2b' }}>Navbar.tsx</span>
            {status === 'sent' && <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--ochre)', background: 'rgba(201,147,58,0.1)', border: '1px solid rgba(201,147,58,0.25)', borderRadius: 5, padding: '3px 10px' }}>✦ Injected</span>}
          </div>
          <div style={{ flex: 1, padding: '14px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, lineHeight: 1.8 }}>
            {status === 'idle' && <span style={{ color: '#1e3a1c', fontStyle: 'italic' }}>// Tap Send to Code →</span>}
            {status !== 'idle' && <>
              <span style={{ color: '#3d6038' }}>// Navbar.tsx — injected</span><br />
              <span style={{ color: '#c9933a' }}>import</span> <span style={{ color: '#8aaa85' }}>{'{ useState }'}</span> <span style={{ color: '#c9933a' }}>from</span> <span style={{ color: '#98c379' }}>&apos;react&apos;</span><br /><br />
              {['export function Navbar() {','  const [dark, setDark] = useState(false)','  const toggle = () => setDark(d => !d)','  return <nav>...</nav>','}'].map((line, i) => (
                <span key={i} style={{ display: 'block', background: 'rgba(201,147,58,0.07)', borderLeft: '2px solid var(--ochre)', margin: '0 -16px', padding: '1px 16px', color: '#8aaa85' }}>{line}</span>
              ))}
            </>}
          </div>
        </div>
      </div>
    </section>
  );
}
