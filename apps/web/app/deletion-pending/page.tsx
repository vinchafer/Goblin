import { GRACE_PERIOD_DAYS } from '@/lib/account-deletion';

export const metadata = { title: 'Konto wird gelöscht — Goblin' };

export default function DeletionPendingPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--paper)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 32, margin: '0 0 16px', color: 'var(--text)' }}>
          Dein Konto wird gelöscht
        </h1>
        <p style={{ color: 'var(--meta)', fontSize: 'var(--t-body-fs)', marginBottom: 16 }}>
          Dein Goblin-Konto wird in {GRACE_PERIOD_DAYS} Tagen unwiderruflich gelöscht. Während dieser Zeit kannst
          du dich nicht einloggen.
        </p>
        <p style={{ color: 'var(--meta)', fontSize: 'var(--t-small-fs)' }}>
          Wir haben dir eine Email geschickt — mit einem Link, mit dem du die Löschung innerhalb
          dieser {GRACE_PERIOD_DAYS} Tage abbrechen kannst.
        </p>
      </div>
    </main>
  );
}
