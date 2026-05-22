const PROVIDERS = [
  'Anthropic',
  'OpenAI',
  'Google',
  'Groq',
  'xAI',
  'Mistral',
  'DeepSeek',
];

export function TrustedBy() {
  return (
    <section
      style={{
        background: 'var(--subtle)',
        borderTop: '1px solid rgba(45,74,43,0.10)',
        borderBottom: '1px solid rgba(45,74,43,0.10)',
        padding: '36px 32px',
      }}
    >
      <div
        style={{
          maxWidth: 1120, margin: '0 auto',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 18,
        }}
      >
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: '#0F2A0D',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          <span aria-hidden="true" style={{ width: 16, height: 1, background: '#0F2A0D' }} />
          Bring your own keys from
          <span aria-hidden="true" style={{ width: 16, height: 1, background: '#0F2A0D' }} />
        </div>
        <div
          style={{
            display: 'flex', flexWrap: 'wrap',
            justifyContent: 'center', alignItems: 'center',
            gap: '18px 32px',
          }}
        >
          {PROVIDERS.map((p, i) => (
            <div key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: '18px' }}>
              <span
                style={{
                  fontFamily: 'Fraunces, serif',
                  fontSize: 18, fontWeight: 600,
                  color: '#1f3a1d',
                  letterSpacing: '-0.015em',
                }}
              >
                {p}
              </span>
              {i < PROVIDERS.length - 1 && (
                <span
                  aria-hidden="true"
                  style={{
                    width: 4, height: 4, borderRadius: '50%',
                    background: 'rgba(45,74,43,0.25)',
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
