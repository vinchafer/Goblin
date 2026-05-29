'use client';

import { useState, useEffect } from 'react';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';
import { SettingsRow } from '../ui/SettingsRow';
import { IOSToggle } from '../ui/IOSToggle';

interface FeatureFlag {
  key: string;
  label: string;
  description?: string;
  defaultValue: boolean;
}

const flags: FeatureFlag[] = [
  { key: 'web_search', label: 'Websuche', description: 'Goblin sucht im Internet nach aktuellen Antworten.', defaultValue: true },
  { key: 'memory', label: 'Erinnerung', description: 'Goblin merkt sich Kontext aus früheren Chats.', defaultValue: false },
  { key: 'voice_input', label: 'Spracheingabe', description: 'Diktiere statt zu tippen.', defaultValue: true },
  { key: 'haptic', label: 'Haptisches Feedback', defaultValue: true },
];

export function FeaturesPage() {
  const [values, setValues] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    for (const f of flags) {
      const stored = localStorage.getItem(`goblin-feature-${f.key}`);
      initial[f.key] = stored === null ? f.defaultValue : stored === 'true';
    }
    setValues(initial);
  }, []);

  const handleChange = (key: string, v: boolean) => {
    setValues((s) => ({ ...s, [key]: v }));
    localStorage.setItem(`goblin-feature-${key}`, String(v));
  };

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <SettingsGroup label="Vorschläge">
        <SettingsCard>
          {flags.slice(0, 3).map((f) => (
            <FeatureRowWithDescription
              key={f.key}
              label={f.label}
              description={f.description!}
              value={values[f.key] ?? f.defaultValue}
              onChange={(v) => handleChange(f.key, v)}
              testId={`toggle-${f.key}`}
            />
          ))}
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup label="App">
        <SettingsCard>
          <SettingsRow
            label="Haptisches Feedback"
            rightVariant="toggle"
            value={values.haptic ?? true}
            onChange={(v) => handleChange('haptic', v)}
            testId="toggle-haptic"
          />
        </SettingsCard>
      </SettingsGroup>
    </div>
  );
}

function FeatureRowWithDescription({ label, description, value, onChange, testId }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void; testId: string }) {
  return (
    <div
      className="list-item"
      onClick={() => onChange(!value)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px 14px 20px',
        minHeight: 72,
        cursor: 'pointer',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 17, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontSize: 14, color: 'var(--text-meta)', marginTop: 2, lineHeight: 1.4 }}>{description}</span>
      </span>
      <IOSToggle value={value} onChange={onChange} testId={testId} ariaLabel={label} />
    </div>
  );
}
