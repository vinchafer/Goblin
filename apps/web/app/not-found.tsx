import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#F7F4ED', padding: '24px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 24 }}>👺</div>
      <h1 style={{
        fontFamily: 'Fraunces, serif', fontSize: 'clamp(32px, 6vw, 56px)',
        color: '#2D4A2B', fontWeight: 900, letterSpacing: '-2px',
        marginBottom: 12,
      }}>
        404
      </h1>
      <p style={{
        fontSize: 18, color: '#6B6B6B', marginBottom: 8,
        fontFamily: 'DM Sans, sans-serif',
      }}>
        This page ran away. Your goblin can&apos;t find it.
      </p>
      <p style={{ fontSize: 14, color: '#9C9589', marginBottom: 36, fontFamily: 'DM Sans, sans-serif' }}>
        Maybe it got deployed somewhere else.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          href="/dashboard"
          style={{
            background: '#2D4A2B', color: '#fff', padding: '12px 24px',
            borderRadius: 10, fontSize: 14, fontWeight: 500, textDecoration: 'none',
          }}
        >
          Back to workshop →
        </Link>
        <Link
          href="/"
          style={{
            background: 'transparent', color: '#6B6B6B', padding: '12px 24px',
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
