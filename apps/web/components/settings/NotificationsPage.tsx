'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';
import { SettingsRow } from '../ui/SettingsRow';
import { useLang, t } from '@/lib/use-lang';

// Honesty sprint (F3): notifications used to live in TWO places over TWO stores —
// here (localStorage `goblin-notif-prefs`) and Personalisierung (server
// `notify_*`). Consolidated to the SERVER store: this is now the single canonical
// notifications surface, backed by /api/account/preferences. Personalisierung's
// duplicate group was removed. Push stays a real browser-permission control
// (inherently device-local — no dead store).

interface ServerNotif {
  notify_build_complete: boolean;
  notify_important_updates: boolean;
  notify_email: boolean;
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
}

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

export function NotificationsPage() {
  const lang = useLang();
  const [prefs, setPrefs] = useState<ServerNotif>({
    notify_build_complete: true,
    notify_important_updates: true,
    notify_email: false,
  });
  const [loaded, setLoaded] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPushPermission(Notification.permission);
    void (async () => {
      try {
        const headers = await authHeaders();
        if (!headers) return;
        const r = await fetch(`${apiBase}/api/account/preferences`, { headers });
        if (r.ok) {
          const d = await r.json();
          setPrefs({
            notify_build_complete: d.notify_build_complete ?? true,
            notify_important_updates: d.notify_important_updates ?? true,
            notify_email: d.notify_email ?? false,
          });
        }
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function patch(next: Partial<ServerNotif>) {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    const headers = await authHeaders();
    if (!headers) return;
    await fetch(`${apiBase}/api/account/preferences`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(next),
    }).catch(() => { /* keep optimistic state; next load reconciles */ });
  }

  async function togglePush(v: boolean) {
    if (v && pushPermission !== 'granted' && typeof Notification !== 'undefined') {
      const res = await Notification.requestPermission();
      setPushPermission(res);
    }
  }

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <SettingsGroup label={t(lang, 'Benachrichtigungen', 'Notifications')}>
        <SettingsCard>
          <SettingsRow
            label={t(lang, 'Push-Benachrichtigungen', 'Push notifications')}
            rightVariant="toggle"
            value={pushPermission === 'granted'}
            onChange={togglePush}
            disabled={pushPermission === 'denied'}
          />
          <SettingsRow
            label={t(lang, 'Build abgeschlossen', 'Build complete')}
            rightVariant="toggle"
            value={prefs.notify_build_complete}
            onChange={(v) => void patch({ notify_build_complete: v })}
            disabled={!loaded}
          />
          <SettingsRow
            label={t(lang, 'Wichtige Updates', 'Important updates')}
            rightVariant="toggle"
            value={prefs.notify_important_updates}
            onChange={(v) => void patch({ notify_important_updates: v })}
            disabled={!loaded}
          />
          <SettingsRow
            label={t(lang, 'E-Mail (Account-Events)', 'Email (account events)')}
            rightVariant="toggle"
            value={prefs.notify_email}
            onChange={(v) => void patch({ notify_email: v })}
            disabled={!loaded}
          />
        </SettingsCard>
      </SettingsGroup>

      {pushPermission === 'denied' && (
        <p style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--rust)', marginTop: 12, padding: '0 4px' }}>
          {t(lang, 'Push wurde im Browser blockiert. Aktiviere es in den Browser-Einstellungen.', 'Push is blocked in your browser. Enable it in your browser settings.')}
        </p>
      )}
    </div>
  );
}
