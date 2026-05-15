'use client';

import { useState } from 'react';
import { useApp } from '@/contexts/app-context';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '../ui/BottomSheet';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsRow } from '../ui/SettingsRow';
import { useUser } from '@/lib/hooks/useUser';
import { useAuth } from '@/lib/hooks/useAuth';

const GearIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
const UpgradeIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><polyline points="8 12 12 8 16 12"/><line x1="12" y1="16" x2="12" y2="8"/></svg>;
const HelpIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>;
const LogoutIcon = ({ color = 'currentColor' }: { color?: string }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;

export function AvatarMenu() {
  const [open, setOpen] = useState(false);
  const user = useUser();
  const { signOut } = useAuth();
  const { setShowSettingsSheet } = useApp();
  const router = useRouter();
  const initial = (user.fullName?.[0] ?? user.email?.[0] ?? 'V').toUpperCase();

  return (
    <>
      <button
        data-testid="header-avatar"
        onClick={() => setOpen(true)}
        aria-label="Konto-Menü"
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'var(--ochre-dark)',
          color: '#2a1f0f',
          border: 'none',
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'var(--font-ui)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {initial}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} size="auto" testId="avatar-menu-sheet">
        <div style={{ padding: '0 16px 16px', fontFamily: 'var(--font-ui)' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 4px 16px',
            borderBottom: '1px solid var(--border-hairline)',
            marginBottom: 12,
          }}>
            <span style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--moss)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 600,
            }}>{initial}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{user.fullName || 'Vincent'}</div>
              <div style={{
                fontSize: 13,
                color: 'var(--text-meta)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>{user.email}</div>
            </div>
            <span style={{
              padding: '4px 10px',
              borderRadius: 12,
              background: 'var(--subtle)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--meta)',
              flexShrink: 0,
            }}>{user.plan.name}</span>
          </div>

          <SettingsCard>
            <SettingsRow
              testId="avatar-menu-settings"
              icon={<GearIcon />}
              label="Einstellungen"
              onClick={() => { setOpen(false); setShowSettingsSheet(true); }}
            />
            <SettingsRow
              icon={<UpgradeIcon />}
              label="Plan upgraden"
              onClick={() => { setOpen(false); router.push('/dashboard/billing'); }}
            />
            <SettingsRow
              icon={<HelpIcon />}
              label="Hilfe"
              onClick={() => { setOpen(false); router.push('/help'); }}
            />
          </SettingsCard>

          <div style={{ marginTop: 12 }}>
            <SettingsCard>
              <SettingsRow
                icon={<LogoutIcon color="var(--rust)" />}
                label="Abmelden"
                labelColor="var(--rust)"
                rightVariant="none"
                onClick={() => { setOpen(false); void signOut(); }}
              />
            </SettingsCard>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
