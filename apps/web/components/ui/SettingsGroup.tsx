export function SettingsGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h3
        style={{
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'var(--font-sans)',
          color: 'var(--text-meta)',
          margin: '0 0 8px 16px',
        }}
      >
        {label}
      </h3>
      {children}
    </section>
  );
}
