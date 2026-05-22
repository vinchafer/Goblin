const CODE_LINES = [
  'export function Navbar() {',
  '  const [dark, setDark] = useState(false)',
  '  const toggle = () => setDark(d => !d)',
  '  return <nav>...</nav>',
  '}',
];

export function SendToCodeDemo() {
  return (
    <section
      style={{
        background: 'var(--subtle)',
        padding: '120px 32px',
        borderTop: '1px solid rgba(45,74,43,0.08)',
        borderBottom: '1px solid rgba(45,74,43,0.08)',
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64, maxWidth: 660, marginLeft: 'auto', marginRight: 'auto' }}>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#1F3A1D', color: '#F0CF8A',
              padding: '6px 14px', borderRadius: 100,
              fontSize: 11, fontWeight: 700,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              marginBottom: 22, fontFamily: 'DM Sans, sans-serif',
              boxShadow: '0 4px 12px -4px rgba(31,58,29,0.40)',
            }}
          >
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: '#F0CF8A' }} />
            Core feature
          </div>
          <h2
            style={{
              fontFamily: 'Fraunces, serif',
              fontSize: 'clamp(36px, 4.8vw, 58px)',
              color: '#0F2A0D',
              lineHeight: 1.05,
              letterSpacing: '-0.025em',
              fontWeight: 700,
              margin: '0 0 18px',
            }}
          >
            One tap.{' '}
            <em style={{ fontStyle: 'italic', color: '#7A5A12', fontWeight: 700 }}>
              Code lands in your editor.
            </em>
          </h2>
          <p
            style={{
              fontSize: 18,
              color: '#1F3A1D',
              lineHeight: 1.6, fontWeight: 500,
              fontFamily: 'DM Sans, sans-serif',
              margin: 0,
            }}
          >
            No clipboard. No tab juggling. AI writes — you ship.
          </p>
        </div>

        <div
          className="stc-illustration"
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: '1fr 72px 1fr',
            alignItems: 'stretch',
            maxWidth: 1040,
            margin: '0 auto',
          }}
        >
          {/* Chat card */}
          <div
            style={{
              background: '#fff',
              border: '1px solid rgba(45,74,43,0.10)',
              borderRadius: 16,
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 24px 60px -28px rgba(45,74,43,0.30)',
            }}
          >
            <div
              style={{
                background: 'var(--moss)',
                padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: 12,
                borderBottom: '1px solid rgba(0,0,0,0.20)',
              }}
            >
              <span
                style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: 'rgba(212,167,55,0.20)',
                  border: '1px solid rgba(212,167,55,0.35)',
                  color: 'var(--ochre)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Fraunces, serif', fontSize: 12, fontWeight: 700,
                }}
              >
                G
              </span>
              <span style={{ fontFamily: 'DM Sans, sans-serif', color: '#fff', fontSize: 14, fontWeight: 600 }}>
                Goblin Chat
              </span>
              <span
                style={{
                  marginLeft: 'auto', fontSize: 10,
                  fontFamily: 'JetBrains Mono, monospace',
                  background: 'rgba(212,167,55,0.15)',
                  border: '1px solid rgba(212,167,55,0.30)',
                  color: 'var(--ochre)',
                  padding: '2px 8px', borderRadius: 100,
                }}
              >
                claude-sonnet-4-6
              </span>
            </div>

            <div style={{ flex: 1, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  alignSelf: 'flex-end',
                  background: 'var(--moss)',
                  color: 'rgba(255,255,255,0.94)',
                  borderRadius: 12, padding: '9px 14px',
                  fontSize: 13, maxWidth: '82%',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                Add a dark mode toggle to the navbar
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: 'var(--moss)', color: 'var(--ochre)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                    fontFamily: 'Fraunces, serif',
                  }}
                >
                  G
                </div>
                <div
                  style={{
                    background: 'var(--cream)',
                    border: '1px solid rgba(45,74,43,0.12)',
                    borderRadius: 12, padding: '12px 14px',
                    fontSize: 13, flex: 1,
                    fontFamily: 'DM Sans, sans-serif',
                    color: '#1f3a1d',
                    fontWeight: 500,
                  }}
                >
                  Here&apos;s your updated component:
                  <pre
                    style={{
                      background: '#1a2018',
                      borderRadius: 8,
                      padding: '12px 14px',
                      margin: '10px 0',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 11, color: '#8aaa85', lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                      border: '1px solid rgba(45,74,43,0.40)',
                    }}
                  >
                    <span style={{ color: '#d4a737' }}>export function</span>{' '}
                    <span style={{ color: '#7dd3a8' }}>Navbar</span>() {'{'}{'\n'}
                    {'  '}<span style={{ color: '#d4a737' }}>const</span> [dark, setDark] ={' '}
                    <span style={{ color: '#7dd3a8' }}>useState</span>(false){'\n'}
                    {'  '}<span style={{ color: '#d4a737' }}>return</span>{' '}
                    &lt;<span style={{ color: '#7dd3a8' }}>nav</span>&gt;...&lt;/
                    <span style={{ color: '#7dd3a8' }}>nav</span>&gt;{'\n'}
                    {'}'}
                  </pre>
                  <span
                    role="img"
                    aria-label="Send to Code button"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background:
                        'linear-gradient(180deg, #E1B244 0%, #C9933A 100%)',
                      color: '#1a2018',
                      borderRadius: 8,
                      padding: '9px 16px',
                      fontSize: 13, fontWeight: 700,
                      fontFamily: 'DM Sans, sans-serif',
                      boxShadow:
                        '0 1px 0 rgba(255,255,255,0.30) inset, 0 6px 16px rgba(212,167,55,0.35)',
                      letterSpacing: '-0.005em',
                    }}
                  >
                    Send to Code <span aria-hidden="true">→</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Arrow connector */}
          <div
            className="stc-arrow"
            aria-hidden="true"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}
          >
            <div
              className="stc-arrow-line"
              style={{
                position: 'absolute',
                left: 0, right: 0, top: '50%',
                height: 1,
                background:
                  'linear-gradient(90deg, rgba(212,167,55,0) 0%, rgba(212,167,55,0.55) 50%, rgba(212,167,55,0) 100%)',
                transform: 'translateY(-50%)',
              }}
            />
            <div
              className="stc-arrow-dot"
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background:
                  'linear-gradient(180deg, #E1B244 0%, #C9933A 100%)',
                color: '#1a2018',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700,
                boxShadow:
                  '0 1px 0 rgba(255,255,255,0.40) inset, 0 8px 22px rgba(212,167,55,0.45)',
                position: 'relative', zIndex: 1,
                animation: 'stc-nudge 2.6s ease-in-out infinite',
              }}
            >
              →
            </div>
          </div>

          {/* Editor card */}
          <div
            style={{
              background: '#141a12',
              border: '1px solid rgba(212,167,55,0.18)',
              borderRadius: 16,
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px -28px rgba(0,0,0,0.50)',
            }}
          >
            <div
              style={{
                background: '#0f1410',
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 8,
                borderBottom: '1px solid #1e2a1c',
              }}
            >
              <span
                style={{
                  fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                  padding: '3px 10px', borderRadius: 5,
                  background: '#1e2a1c', color: '#a8c8a3',
                  border: '1px solid #2d4a2b',
                }}
              >
                Navbar.tsx
              </span>
              <span
                style={{
                  marginLeft: 'auto', fontSize: 10,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--ochre)',
                  background: 'rgba(212,167,55,0.10)',
                  border: '1px solid rgba(212,167,55,0.28)',
                  borderRadius: 100, padding: '3px 10px',
                  letterSpacing: '0.04em',
                }}
              >
                Injected
              </span>
            </div>
            <div
              style={{
                flex: 1, padding: '16px 18px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11.5, lineHeight: 1.85,
              }}
            >
              <div style={{ color: '#4a6045' }}>{'// injected via Send to Code'}</div>
              <div>
                <span style={{ color: '#d4a737' }}>import</span>{' '}
                <span style={{ color: '#a8c8a3' }}>{'{ useState }'}</span>{' '}
                <span style={{ color: '#d4a737' }}>from</span>{' '}
                <span style={{ color: '#98c379' }}>&apos;react&apos;</span>
              </div>
              <div style={{ height: 8 }} />
              {CODE_LINES.map((line, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(212,167,55,0.06)',
                    borderLeft: '2px solid var(--ochre)',
                    margin: '0 -18px',
                    padding: '1px 18px',
                    color: '#a8c8a3',
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes stc-nudge {
          0%, 100% { transform: translateX(0); }
          50%      { transform: translateX(3px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .stc-arrow-dot { animation: none !important; }
        }
        @media (max-width: 860px) {
          .stc-illustration {
            grid-template-columns: 1fr !important;
            gap: 0 !important;
          }
          .stc-arrow {
            height: 64px !important;
          }
          .stc-arrow-line {
            left: 50% !important;
            right: auto !important;
            top: 0 !important;
            width: 1px !important;
            height: 100% !important;
            background: linear-gradient(180deg, rgba(212,167,55,0) 0%, rgba(212,167,55,0.55) 50%, rgba(212,167,55,0) 100%) !important;
            transform: translateX(-50%) !important;
          }
          .stc-arrow-dot {
            transform: rotate(90deg);
            animation: stc-nudge-v 2.6s ease-in-out infinite !important;
          }
          @keyframes stc-nudge-v {
            0%, 100% { transform: rotate(90deg) translateX(0); }
            50%      { transform: rotate(90deg) translateX(3px); }
          }
        }
      `}</style>
    </section>
  );
}
