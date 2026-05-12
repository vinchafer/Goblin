export default function Loading() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
      background: 'var(--cream, #F7F4ED)',
    }}>
      <div style={{
        fontFamily: 'Fraunces, serif', fontSize: 24,
        color: 'var(--ochre, #D4A94A)', fontWeight: 700, letterSpacing: '-0.5px',
        animation: 'goblin-wobble 2.4s ease-in-out infinite',
      }}>
        👺
      </div>
      <div style={{
        width: 32, height: 3, borderRadius: 2,
        background: 'rgba(212,169,74,0.2)', overflow: 'hidden', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: '60%', height: '100%', borderRadius: 2,
          background: 'var(--ochre, #D4A94A)',
          animation: 'pw 1.8s ease-in-out infinite alternate',
        }} />
      </div>
    </div>
  );
}