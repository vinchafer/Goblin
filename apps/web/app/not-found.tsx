import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--cream)', padding: '24px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 24 }}>👺</div>
      <h1 style={{
        fontFamily: 'Fraunces, serif', fontSize: 'clamp(32px, 6vw, 56px)',
        color: 'var(--moss)', fontWeight: 900, letterSpacing: '-2px',
        marginBottom: 12,
      }}>
        404
      </h1>
      <p style={{
        fontSize: 18, color: 'var(--meta)', marginBottom: 8,
        fontFamily: 'DM Sans, sans-serif',
      }}>
        This page ran away. Your goblin can&apos;t find it.
      </p>
      <p style={{ fontSize: 14, color: 'var(--text-faint)', marginBottom: 36, fontFamily: 'DM Sans, sans-serif' }}>
        Maybe it got deployed somewhere else.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          href="/dashboard"
          style={{
            background: 'var(--moss)', color: '#fff', padding: '12px 24px',
            borderRadius: 10, fontSize: 14, fontWeight: 500, textDecoration: 'none',
          }}
        >
          Back to workshop →
        </Link>
        <Link
          href="/"
          style={{
            background: 'transparent', color: 'var(--meta)', padding: '12px 24px',
            borderRadius: 10, fontSize: 14, fontWeight: 400, textDecoration: 'none',
            border: '1px solid rgba(0,0,0,0.12)',
          }}
        >
          Home
        </Link>
      </div>
    </div>
  );
}
