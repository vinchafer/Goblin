export function StubPage({ title }: { title: string }) {
  return (
    <div style={{ padding: 24, fontFamily: 'var(--font-ui)' }}>
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 32,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>⚙️</div>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{title}</h3>
        <p style={{ fontSize: 14, color: 'var(--text-meta)', margin: 0 }}>
          Diese Seite wird in einer kommenden Session aktiviert.
        </p>
      </div>
    </div>
  );
}
