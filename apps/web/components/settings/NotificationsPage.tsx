'use client';

import { useEffect, useState } from 'react';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';
import { SettingsRow } from '../ui/SettingsRow';

interface Prefs {
  push: boolean;
  email: boolean;
  deploy: boolean;
}

const KEY = 'goblin-notif-prefs';

export function NotificationsPage() {
  const [prefs, setPrefs] = useState<Prefs>({ push: false, email: true, deploy: true });
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setPrefs(JSON.parse(raw));
      if (typeof Notification !== 'undefined') setPushPermission(Notification.permission);
    } catch {}
  }, []);

  function update(p: Prefs) {
    setPrefs(p);
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
  }

  async function togglePush(v: boolean) {
    if (v && pushPermission !== 'granted' && typeof Notification !== 'undefined') {
      const res = await Notification.requestPermission();
      setPushPermission(res);
      if (res !== 'granted') return;
    }
    update({ ...prefs, push: v });
  }

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <SettingsGroup label="Benachrichtigungen">
        <SettingsCard>
          <SettingsRow
            label="Push-Benachrichtigungen"
            rightVariant="toggle"
            value={prefs.push && pushPermission === 'granted'}
            onChange={togglePush}
            disabled={pushPermission === 'denied'}
          />
          <SettingsRow
            label="E-Mail (Account-Events)"
            rightVariant="toggle"
            value={prefs.email}
            onChange={(v) => update({ ...prefs, email: v })}
          />
          <SettingsRow
            label="Deploy-Benachrichtigungen"
            rightVariant="toggle"
            value={prefs.deploy}
            onChange={(v) => update({ ...prefs, deploy: v })}
          />
        </SettingsCard>
      </SettingsGroup>

      {pushPermission === 'denied' && (
        <p style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--rust)', marginTop: 12, padding: '0 4px' }}>
          Push wurde im Browser blockiert. Aktiviere es in den Browser-Einstellungen.
        </p>
      )}
    </div>
  );
}
