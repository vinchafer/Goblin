'use client';
// LEGACY — superseded by SettingsRoot + SettingsModal. Direct-URL
// access only. Do not extend; future settings additions belong in
// SettingsRoot (apps/web/components/settings/SettingsRoot.tsx)
// and components/settings/sections.ts.

import { GOBLIN_HOSTED_MODELS } from '@/lib/goblin-hosted-models';

export default function GoblinHostedSettingsPage() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 24, color: 'var(--brand-green)', fontWeight: 700, letterSpacing: '-0.5px', margin: 0 }}>
          Goblin-Hosted Models
        </h1>
        <span style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
          background: 'rgba(212,169,74,0.15)', color: 'var(--brand-gold)',
          border: '1px solid rgba(212,169,74,0.4)', padding: '2px 8px', borderRadius: 4,
        }}>
          Coming Soon
        </span>
      </div>

      <p style={{ fontSize: 14, color: 'var(--meta)', fontFamily: 'var(--font-sans)', lineHeight: 1.7, marginBottom: 32 }}>
        Open-source AI models hosted directly by Goblin — no API key needed.
        Just use your plan&apos;s monthly call allowance.
      </p>

      {/* Status card */}
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '20px 24px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-gold)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            Service not yet active
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--meta)', fontFamily: 'var(--font-sans)', lineHeight: 1.6, margin: 0 }}>
          Goblin-Hosted models launch with our first 100 paying users.
          Until then, use BYOK to connect your own API keys.
        </p>
      </div>

      {/* Planned models */}
      <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--text)', fontWeight: 700, marginBottom: 12 }}>
        Planned Models
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
        {GOBLIN_HOSTED_MODELS.map(model => (
          <div key={model.id} style={{
            background: 'var(--subtle)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '14px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            opacity: 0.7,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', marginBottom: 2 }}>
                {model.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--meta)', fontFamily: 'var(--font-sans)' }}>
                {model.description}
              </div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'var(--meta)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 4,
            }}>
              Soon
            </span>
          </div>
        ))}
      </div>

      {/* Fair-use counter placeholder */}
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '20px 24px',
      }}>
        <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
          Monthly Usage
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--meta)', fontFamily: 'var(--font-sans)' }}>Goblin-Hosted calls</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            0 / — (service launches soon)
          </span>
        </div>
        <div style={{ height: 4, background: 'var(--subtle)', borderRadius: 2 }} />
      </div>
    </div>
  );
}
