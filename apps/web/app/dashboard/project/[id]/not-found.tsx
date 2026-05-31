// B8 (Sprint 2): real in-app 404 for a bad/unknown project id. The page component calls
// notFound() when the project doesn't belong to the user or doesn't exist; this renders a
// branded 404 instead of bouncing to /login.
import Link from 'next/link';

export default function ProjectNotFound() {
  return (
    <div style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14,
      padding: 24, textAlign: 'center', fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-meta)' }}>
        404
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
        Projekt nicht gefunden
      </h1>
      <p style={{ fontSize: 'var(--t-small-fs)', color: 'var(--text-meta)', maxWidth: 380, margin: 0 }}>
        Dieses Projekt existiert nicht oder gehört nicht zu deinem Konto.
      </p>
      <Link href="/dashboard" style={{
        marginTop: 6, padding: '9px 18px', borderRadius: 9,
        background: 'var(--brand-green)', color: 'var(--on-brand, #fff)',
        fontSize: 'var(--t-small-fs)', fontWeight: 600, textDecoration: 'none',
      }}>
        Zurück zum Dashboard
      </Link>
    </div>
  );
}
