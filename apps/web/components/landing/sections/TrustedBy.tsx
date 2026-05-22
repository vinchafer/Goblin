const PROVIDERS = ['Anthropic', 'OpenAI', 'Google', 'Groq', 'xAI', 'Mistral', 'DeepSeek'];

export function TrustedBy() {
  return (
    <section className="trusted">
      <div className="trusted-inner">
        <div className="trusted-label">
          <span className="rule" aria-hidden="true" />
          Bring your own keys from
          <span className="rule" aria-hidden="true" />
        </div>
        <div className="trusted-row">
          {PROVIDERS.map((name, i) => (
            <span key={name} style={{ display: 'contents' }}>
              <span className="provider">{name}</span>
              {i < PROVIDERS.length - 1 ? <span className="sep" aria-hidden="true" /> : null}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
