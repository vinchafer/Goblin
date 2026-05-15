'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/app-context';
import { createClient } from '@/lib/supabase/client';

type IconName = 'user' | 'palette' | 'bell' | 'chart' | 'card' | 'shield' | 'key' | 'lock' | 'eye' | 'plug' | 'link' | 'terminal';

interface SettingsItem {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  external?: string; // route fallback for items not yet inline
  developer?: boolean;
}

const ITEMS: SettingsItem[] = [
  { id: 'profile',        label: 'Profil',              hint: 'Avatar, Name, Sicherheit',          icon: 'user' },
  { id: 'appearance',     label: 'Erscheinungsbild',    hint: 'Theme, Sprache',                    icon: 'palette' },
  { id: 'notifications',  label: 'Benachrichtigungen',  hint: 'Email-Präferenzen',                 icon: 'bell',  external: '/dashboard/settings/notifications' },
  { id: 'usage',          label: 'Nutzung',             hint: 'Tokens, Cost-Trends',               icon: 'chart' },
  { id: 'billing',        label: 'Abrechnung',          hint: 'Plan + Zahlung',                    icon: 'card', external: '/dashboard/settings/billing' },
  { id: 'permissions',    label: 'Berechtigungen',      hint: 'Auto-Approve, Sandbox-Limits',      icon: 'shield' },
  { id: 'api-keys',       label: 'API Keys',            hint: 'BYOK-Provider',                     icon: 'key',  external: '/dashboard/settings/api-keys' },
  { id: 'env-vars',       label: 'Env. Vars',           hint: 'Geheime Variablen',                 icon: 'lock' },
  { id: 'privacy',        label: 'Datenschutz',         hint: 'GDPR Export & Delete',              icon: 'eye' },
  { id: 'integrations',   label: 'Integrationen',       hint: 'Stripe, GitHub',                    icon: 'plug', external: '/dashboard/settings/integrations' },
  { id: 'connectors',     label: 'Konnektoren',         hint: 'Google, GitHub, etc.',              icon: 'link' },
  // developer separator (group below)
  { id: 'dev-logs',       label: 'API-Logs',            hint: 'Request/Response-Verlauf',          icon: 'terminal', developer: true },
  { id: 'dev-webhooks',   label: 'Webhooks',            hint: 'Outbound-Events',                   icon: 'terminal', developer: true },
  { id: 'dev-schema',     label: 'DB-Schema-View',      hint: 'Tabellen-Übersicht',                icon: 'terminal', developer: true },
  { id: 'dev-flags',      label: 'Feature-Flags',       hint: 'Beta-Toggles',                      icon: 'terminal', developer: true },
  { id: 'dev-debug',      label: 'Debug-Mode',          hint: 'Verbose Logging',                   icon: 'terminal', developer: true },
];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'user':     return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>;
    case 'palette':  return <svg {...common}><circle cx="12" cy="12" r="10"/><circle cx="7" cy="10" r="1.2" fill="currentColor"/><circle cx="12" cy="6" r="1.2" fill="currentColor"/><circle cx="17" cy="10" r="1.2" fill="currentColor"/><circle cx="15" cy="16" r="1.2" fill="currentColor"/></svg>;
    case 'bell':     return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>;
    case 'chart':    return <svg {...common}><line x1="3" y1="20" x2="21" y2="20"/><rect x="6" y="10" width="3" height="10"/><rect x="11" y="6" width="3" height="14"/><rect x="16" y="13" width="3" height="7"/></svg>;
    case 'card':     return <svg {...common}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>;
    case 'shield':   return <svg {...common}><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/></svg>;
    case 'key':      return <svg {...common}><circle cx="7.5" cy="15.5" r="3.5"/><path d="M10 13l8-8 3 3-3 3 2 2-3 3-2-2-2 2"/></svg>;
    case 'lock':     return <svg {...common}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>;
    case 'eye':      return <svg {...common}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'plug':     return <svg {...common}><path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0z"/><path d="M12 16v6"/></svg>;
    case 'link':     return <svg {...common}><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>;
    case 'terminal': return <svg {...common}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>;
  }
}

export function SettingsSheet() {
  const router = useRouter();
  const { showSettingsSheet, setShowSettingsSheet, settingsInitialItem, setSettingsInitialItem } = useApp();
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (showSettingsSheet) {
      setActiveItem(settingsInitialItem);
      setClosing(false);
    }
  }, [showSettingsSheet, settingsInitialItem]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!showSettingsSheet) return;
      if (e.key === 'Escape') {
        if (activeItem) setActiveItem(null);
        else close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSettingsSheet, activeItem]);

  const close = () => {
    setClosing(true);
    setTimeout(() => {
      setShowSettingsSheet(false);
      setSettingsInitialItem(null);
      setActiveItem(null);
      setClosing(false);
    }, 200);
  };

  if (!showSettingsSheet) return null;

  const regular = ITEMS.filter(i => !i.developer);
  const developer = ITEMS.filter(i => i.developer);
  const activeDef = activeItem ? ITEMS.find(i => i.id === activeItem) : null;

  return (
    <>
      <div
        onClick={close}
        data-testid="settings-sheet-backdrop"
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(3px)', zIndex: 250,
          animation: closing ? 'goblin-fade-out 0.18s ease' : 'goblin-fade-in 0.18s ease',
          opacity: closing ? 0 : 1,
        }}
      />
      <div
        role="dialog"
        aria-label="Settings"
        data-testid="settings-sheet"
        className="goblin-settings-sheet"
        style={{
          position: 'fixed', zIndex: 251,
          background: 'var(--panel, #fff)',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'DM Sans, sans-serif',
          animation: closing ? 'goblin-sheet-out 0.2s ease' : 'goblin-sheet-in 0.22s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Drag handle (mobile) */}
        <div className="goblin-sheet-handle" style={{
          height: 5, width: 40, background: 'rgba(0,0,0,0.18)',
          borderRadius: 3, margin: '8px auto 4px', flexShrink: 0,
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px 14px', borderBottom: '1px solid var(--div)',
          flexShrink: 0, gap: 12,
        }}>
          {activeItem ? (
            <button
              onClick={() => setActiveItem(null)}
              aria-label="Back"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 6, marginLeft: -6, borderRadius: 6,
                display: 'flex', alignItems: 'center', color: 'var(--moss)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          ) : (
            <button
              onClick={close}
              aria-label="Close settings"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 6, marginLeft: -6, borderRadius: 6,
                display: 'flex', alignItems: 'center', color: 'var(--meta)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
              </svg>
            </button>
          )}
          <h2 style={{
            flex: 1, textAlign: 'center', margin: 0,
            fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 700,
            color: 'var(--moss)', letterSpacing: '-0.3px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {activeDef ? activeDef.label : 'Einstellungen'}
          </h2>
          <div style={{ width: 28 }} />
        </div>

        {/* Body */}
        <div className="goblin-sheet-body" style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          {!activeItem && (
            <ListPane
              regular={regular}
              developer={developer}
              onPick={(id, def) => {
                if (def.external) {
                  close();
                  setTimeout(() => router.push(def.external!), 200);
                  return;
                }
                setActiveItem(id);
              }}
            />
          )}
          {activeItem && (
            <DetailPane itemId={activeItem} onClose={close} onSignOutDone={() => { close(); router.push('/login'); }} />
          )}
        </div>
      </div>

      <style>{`
        @keyframes goblin-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes goblin-fade-out { from { opacity: 1 } to { opacity: 0 } }
        @keyframes goblin-sheet-in { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes goblin-sheet-out { from { transform: translateY(0); opacity: 1 } to { transform: translateY(20px); opacity: 0 } }
        .goblin-settings-sheet {
          right: 50%; bottom: 50%; transform: translate(50%, 50%);
          width: min(720px, calc(100vw - 32px));
          max-height: 80vh; border-radius: 16px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.22);
          border: 1px solid var(--div);
        }
        .goblin-settings-sheet .goblin-sheet-handle { display: none; }
        @media (max-width: 768px) {
          .goblin-settings-sheet {
            right: 0; left: 0; bottom: 0; top: auto; transform: none;
            width: 100%; max-height: 88vh; border-radius: 18px 18px 0 0;
            border: none; padding-bottom: env(safe-area-inset-bottom, 0);
          }
          .goblin-settings-sheet .goblin-sheet-handle { display: block; }
          @keyframes goblin-sheet-in { from { transform: translateY(100%); opacity: 0.6 } to { transform: translateY(0); opacity: 1 } }
          @keyframes goblin-sheet-out { from { transform: translateY(0); opacity: 1 } to { transform: translateY(100%); opacity: 0 } }
        }
      `}</style>
    </>
  );
}

// ─── List Pane ────────────────────────────────────────────────────────────────

function ListPane({
  regular, developer, onPick,
}: {
  regular: SettingsItem[];
  developer: SettingsItem[];
  onPick: (id: string, def: SettingsItem) => void;
}) {
  return (
    <div style={{ padding: '12px 0 20px' }}>
      <UserCard />
      <Section>
        {regular.map(item => <Row key={item.id} item={item} onClick={() => onPick(item.id, item)} />)}
      </Section>
      <SectionLabel>Developer Settings</SectionLabel>
      <Section>
        {developer.map(item => <Row key={item.id} item={item} onClick={() => onPick(item.id, item)} muted />)}
      </Section>
      <div style={{ padding: '16px 20px 0' }}>
        <SignOutButton />
      </div>
    </div>
  );
}

function UserCard() {
  const [email, setEmail] = useState<string>('');
  const [name, setName] = useState<string>('');
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      setEmail(session.user.email ?? '');
      setName(session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? '');
    });
  }, []);
  if (!email) return null;
  const initial = (name || email).charAt(0).toUpperCase();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 20px 18px', borderBottom: '1px solid var(--div)',
      marginBottom: 6,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: 'var(--moss)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 18, flexShrink: 0,
      }}>{initial}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {name && <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{name}</div>}
        <div style={{ fontSize: 12, color: 'var(--meta)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {email}
        </div>
      </div>
    </div>
  );
}

function Section({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: 'transparent', padding: '4px 12px' }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      padding: '20px 20px 6px', fontSize: 11, fontWeight: 600,
      letterSpacing: '1.2px', textTransform: 'uppercase',
      color: 'var(--text-faint, #999)',
    }}>{children}</div>
  );
}

function Row({ item, onClick, muted }: { item: SettingsItem; onClick: () => void; muted?: boolean }) {
  return (
    <button
      onClick={onClick}
      data-testid={`settings-row-${item.id}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '12px 10px',
        background: 'none', border: 'none', cursor: 'pointer',
        borderRadius: 9, textAlign: 'left',
        fontFamily: 'DM Sans, sans-serif',
        transition: 'background 0.12s',
        minHeight: 52,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      <span style={{
        width: 36, height: 36, borderRadius: 9,
        background: muted ? 'rgba(0,0,0,0.04)' : 'rgba(45,74,43,0.08)',
        color: muted ? 'var(--meta)' : 'var(--moss)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name={item.icon} size={18} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{item.label}</span>
        {item.hint && <span style={{ display: 'block', fontSize: 12, color: 'var(--meta)', marginTop: 2 }}>{item.hint}</span>}
      </span>
      <span style={{ color: 'var(--text-faint, #999)', flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </span>
    </button>
  );
}

function SignOutButton() {
  const handle = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };
  return (
    <button
      onClick={handle}
      style={{
        width: '100%', padding: '12px 16px', borderRadius: 10,
        background: 'rgba(184,92,60,0.08)', color: 'var(--danger, #B85C3C)',
        border: '1px solid rgba(184,92,60,0.2)', cursor: 'pointer',
        fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
        minHeight: 44,
      }}
    >
      Sign out
    </button>
  );
}

// ─── Detail Pane ──────────────────────────────────────────────────────────────

function DetailPane({ itemId, onClose, onSignOutDone }: { itemId: string; onClose: () => void; onSignOutDone: () => void }) {
  void onClose; void onSignOutDone;
  switch (itemId) {
    case 'profile':       return <ProfileDetail />;
    case 'appearance':    return <AppearanceDetail />;
    case 'usage':         return <Placeholder title="Nutzung" body="Token-Verbrauch, Cost-Trends und Auslastung pro Modell. Wird aus Billing-Daten aggregiert." />;
    case 'permissions':   return <Placeholder title="Berechtigungen" body="Auto-Approve-Schwellen, Sandbox-Limits, Tool-Use Whitelist. (Kommt mit Phase 10.)" />;
    case 'env-vars':      return <EnvVarsDetail />;
    case 'privacy':       return <Placeholder title="Datenschutz" body="GDPR-Konformer Datenexport und Account-Löschung. Email-Anfrage an support@goblin.app bis Self-Service in Phase 10 ausgeliefert ist." />;
    case 'connectors':    return <Placeholder title="Konnektoren" body="Google, GitHub OAuth-Verknüpfungen. (Aktuell via API Keys.)" />;
    case 'dev-logs':      return <Placeholder title="API-Logs" body="Request/Response-Verlauf der letzten 100 Calls. Wird in Phase 10 ausgeliefert." />;
    case 'dev-webhooks':  return <Placeholder title="Webhooks" body="Outbound-Events für Build/Deploy/Chat. Kommt mit Phase 10." />;
    case 'dev-schema':    return <Placeholder title="DB-Schema-View" body="Tabellen-Übersicht des Projekt-Workspaces. Kommt mit Phase 10." />;
    case 'dev-flags':     return <Placeholder title="Feature-Flags" body="Beta-Toggles für Power-User. Kommt mit Phase 10." />;
    case 'dev-debug':     return <Placeholder title="Debug-Mode" body="Verbose Logging in Browser-Console und API-Responses." />;
    default:              return <Placeholder title="Coming soon" body="" />;
  }
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ padding: '24px 24px 32px' }}>
      <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: 'var(--moss)', marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--meta)', lineHeight: 1.6 }}>{body}</p>
    </div>
  );
}

function ProfileDetail() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      setEmail(session.user.email ?? '');
      setName(session.user.user_metadata?.full_name ?? '');
      setDisplayName(session.user.user_metadata?.display_name ?? '');
    });
  }, []);

  return (
    <div style={{ padding: '20px 20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Identität">
        <Field label="Email">{email || '—'}</Field>
        <FormInput label="Vollständiger Name" value={name} onChange={setName} placeholder="Vorname Nachname" />
        <FormInput label="Anzeigename" value={displayName} onChange={setDisplayName} placeholder="Wie du angezeigt wirst" />
      </Card>
      <Card title="Sicherheit">
        <Field label="2-Faktor">Nicht aktiv</Field>
        <Field label="Passwort">Über E-Mail-Reset änderbar</Field>
      </Card>
      <Card title="Aktive Sessions">
        <Field label="Diese Session">Aktiv</Field>
      </Card>
      <Card title="Danger Zone" danger>
        <DangerButton label="Account löschen" hint="Permanent. Daten werden nach 30 Tagen entfernt." />
      </Card>
    </div>
  );
}

function AppearanceDetail() {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('goblin:theme') as 'system' | 'light' | 'dark' | null;
    if (stored) setTheme(stored);
  }, []);
  const apply = (next: 'system' | 'light' | 'dark') => {
    setTheme(next);
    localStorage.setItem('goblin:theme', next);
    if (next === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', next);
    }
  };
  return (
    <div style={{ padding: '20px 20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Theme">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['system', 'light', 'dark'] as const).map(t => (
            <button
              key={t}
              onClick={() => apply(t)}
              style={{
                flex: '1 1 100px', padding: '10px 14px', borderRadius: 8,
                border: theme === t ? '2px solid var(--moss)' : '1.5px solid var(--div)',
                background: theme === t ? 'rgba(45,74,43,0.08)' : 'transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
                color: theme === t ? 'var(--moss)' : 'var(--text)',
                fontFamily: 'DM Sans, sans-serif', textTransform: 'capitalize',
              }}
            >
              {t === 'system' ? 'System' : t === 'light' ? 'Hell' : 'Dunkel'}
            </button>
          ))}
        </div>
      </Card>
      <Card title="Sprache">
        <Field label="Aktuell">Deutsch (Standard)</Field>
      </Card>
    </div>
  );
}

function EnvVarsDetail() {
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState('');
  if (!unlocked) {
    return (
      <div style={{ padding: '20px 20px 32px' }}>
        <Card title="Geschützter Bereich">
          <p style={{ fontSize: 13, color: 'var(--meta)', lineHeight: 1.6, marginBottom: 14 }}>
            Env. Vars enthalten Secrets. Bitte Account-Passwort bestätigen.
          </p>
          <FormInput label="Passwort" value={pw} onChange={setPw} type="password" placeholder="••••••••" />
          <button
            onClick={() => { if (pw.length >= 4) setUnlocked(true); }}
            disabled={pw.length < 4}
            style={{
              marginTop: 12, padding: '10px 18px', borderRadius: 8,
              background: 'var(--moss)', color: '#fff', border: 'none',
              cursor: pw.length < 4 ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600, opacity: pw.length < 4 ? 0.5 : 1,
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Entsperren
          </button>
        </Card>
      </div>
    );
  }
  return (
    <div style={{ padding: '20px 20px 32px' }}>
      <Card title="Env. Vars">
        <Field label="Anzahl gespeichert">0</Field>
        <p style={{ fontSize: 12, color: 'var(--meta)', marginTop: 12 }}>
          Verwaltung via API in Phase 10. Aktuell nur Anzeige.
        </p>
      </Card>
    </div>
  );
}

function Card({ title, children, danger }: { title: string; children: ReactNode; danger?: boolean }) {
  return (
    <div style={{
      background: 'var(--panel, #fff)',
      border: danger ? '1px solid rgba(184,92,60,0.3)' : '1px solid var(--div)',
      borderRadius: 12, padding: 16,
    }}>
      <h4 style={{
        margin: '0 0 12px', fontSize: 12, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.8px',
        color: danger ? 'var(--danger, #B85C3C)' : 'var(--moss)',
      }}>{title}</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--meta)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', textAlign: 'right' }}>{children}</span>
    </div>
  );
}

function FormInput({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--meta)' }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: '10px 12px', borderRadius: 8,
          border: '1.5px solid var(--div)',
          background: 'var(--surface, #fff)',
          color: 'var(--text)', fontSize: 14,
          fontFamily: 'DM Sans, sans-serif', outline: 'none',
          boxSizing: 'border-box',
        }}
        onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
        onBlur={e => (e.target.style.borderColor = 'var(--div)')}
      />
    </label>
  );
}

function DangerButton({ label, hint }: { label: string; hint: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        onClick={() => { /* TODO Phase 10: confirm-modal + API delete */ }}
        style={{
          padding: '10px 16px', borderRadius: 8,
          background: 'transparent', color: 'var(--danger, #B85C3C)',
          border: '1.5px solid var(--danger, #B85C3C)',
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        {label}
      </button>
      <span style={{ fontSize: 11, color: 'var(--meta)' }}>{hint}</span>
    </div>
  );
}
