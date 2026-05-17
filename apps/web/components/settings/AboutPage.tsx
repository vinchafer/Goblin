'use client';

import { SettingsCard } from '../ui/SettingsCard';
import { SettingsRow } from '../ui/SettingsRow';
import { SettingsGroup } from '../ui/SettingsGroup';

const COMMIT = process.env.NEXT_PUBLIC_COMMIT_SHA ?? 'dev';
const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.9.4';

export function AboutPage() {
  return (
    <div style={{ padding: '0 16px 24px', fontFamily: 'var(--font-ui)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0 32px' }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: 'var(--moss)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          fontFamily: 'var(--font-brand)',
          fontWeight: 700,
        }}>G</div>
        <div style={{ marginTop: 12, fontSize: 20, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-brand)' }}>Goblin</div>
        <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-meta)' }}>Version {VERSION} · {COMMIT.slice(0, 7)}</div>
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-meta)', textAlign: 'center', maxWidth: 280 }}>
          The cloud workshop for builders who ship from anywhere.
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-meta)' }}>Made in Switzerland 🇨🇭</div>
      </div>

      <SettingsGroup label="Rechtliches">
        <SettingsCard>
          <SettingsRow label="Nutzungsbedingungen" onClick={() => { window.location.href = '/terms'; }} />
          <SettingsRow label="Datenschutz" onClick={() => { window.location.href = '/privacy'; }} />
          <SettingsRow label="Impressum" onClick={() => { window.location.href = '/imprint'; }} />
          <SettingsRow label="GitHub" onClick={() => window.open('https://github.com/vinchafner/Goblin', '_blank')} />
        </SettingsCard>
      </SettingsGroup>
    </div>
  );
}
