'use client';
// LEGACY — superseded by SettingsRoot + SettingsModal. Direct-URL
// access only. Do not extend; future settings additions belong in
// SettingsRoot (apps/web/components/settings/SettingsRoot.tsx)
// and components/settings/sections.ts.

import { SettingsLayout } from '@/components/settings/settings-layout';
import { useTheme, type Theme } from '@/lib/theme';
import { Sun, Moon, Desktop } from '@phosphor-icons/react';

const CARD_STYLE = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '28px 28px 24px',
  marginBottom: 20,
};

const THEME_OPTIONS: { value: Theme; label: string; description: string; Icon: React.ElementType }[] = [
  { value: 'light',  label: 'Light',  description: 'Cream surfaces, ideal for daylight and presentations.', Icon: Sun },
  { value: 'dark',   label: 'Dark',   description: 'Deep moss surfaces, easier on the eyes at night.',       Icon: Moon },
  { value: 'system', label: 'System', description: 'Match your OS appearance setting automatically.',        Icon: Desktop },
];

export default function AppearancePage() {
  const { theme, setTheme } = useTheme();

  return (
    <SettingsLayout>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 700, color: 'var(--brand-green)', marginBottom: 6, letterSpacing: '-0.3px' }}>
          Appearance
        </h1>
        <p style={{ fontSize: 13, color: 'var(--meta)', fontFamily: 'var(--font-sans)' }}>
          Choose how Goblin looks. Persists across devices.
        </p>
      </div>

      <div style={CARD_STYLE}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--brand-green)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
          Theme
        </h2>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 20 }}>
          Light mode is optimized for sunlight readability.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {THEME_OPTIONS.map(opt => {
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                style={{
                  textAlign: 'left',
                  padding: '16px 18px',
                  borderRadius: 12,
                  border: active ? '2px solid var(--brand-green)' : '1.5px solid var(--border)',
                  background: active ? 'rgba(45,74,43,0.06)' : 'var(--panel)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'var(--brand-green)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <opt.Icon size={20} weight={active ? 'fill' : 'duotone'} color={active ? 'var(--brand-green)' : 'var(--meta)'} />
                  <span style={{ fontSize: 'var(--t-small-fs)', fontWeight: 600, color: active ? 'var(--brand-green)' : 'var(--text)' }}>
                    {opt.label}
                  </span>
                  {active && (
                    <span style={{
                      marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                      color: 'var(--brand-green)', background: 'rgba(45,74,43,0.12)',
                      padding: '2px 7px', borderRadius: 4, letterSpacing: '0.05em',
                    }}>ACTIVE</span>
                  )}
                </div>
                <p style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', lineHeight: 1.5 }}>
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div style={CARD_STYLE}>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--brand-green)', fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>
          Density
        </h2>
        <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 12 }}>
          Compact or comfortable spacing. Coming soon.
        </p>
        <div style={{ display: 'inline-flex', gap: 0, background: 'var(--subtle)', border: '1px solid var(--div)', borderRadius: 10, padding: 3, opacity: 0.6, pointerEvents: 'none' }}>
          {['Compact', 'Comfortable'].map((d, i) => (
            <button key={d} style={{
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: i === 1 ? 'var(--panel)' : 'transparent',
              fontSize: 13, color: i === 1 ? 'var(--text)' : 'var(--meta)',
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}>{d}</button>
          ))}
        </div>
      </div>
    </SettingsLayout>
  );
}
