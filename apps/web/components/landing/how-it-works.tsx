'use client';

const STEPS = [
  {
    num: '01',
    title: 'Log in from any device',
    desc: 'Your workshop is always ready. Phone, laptop, tablet — it doesn’t matter.',
  },
  {
    num: '02',
    title: 'Tell your goblin what to build',
    desc: 'Plain English works best. No prompt engineering required.',
  },
  {
    num: '03',
    title: 'Send to Code with one tap',
    desc: 'AI output lands directly in your editor. No clipboard, no tab juggling.',
  },
  {
    num: '04',
    title: 'Push to GitHub and go live',
    desc: 'One click publishes. Your code, your repo, your deployment.',
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      style={{
        background: 'var(--cream)',
        padding: '120px 32px',
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 72 }}>
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
            How it works
          </div>
          <h2
            style={{
              fontFamily: 'Fraunces, serif', fontWeight: 700,
              fontSize: 'clamp(36px, 4.8vw, 58px)',
              color: '#0F2A0D',
              letterSpacing: '-0.025em',
              margin: 0, lineHeight: 1.05,
            }}
          >
            Ship in{' '}
            <em style={{ fontStyle: 'italic', color: '#7A5A12', fontWeight: 700 }}>
              four
            </em>{' '}
            steps.
          </h2>
        </div>

        <div
          className="hiw-desktop"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 20,
            maxWidth: 1080,
            margin: '0 auto',
          }}
        >
          {STEPS.map((step) => (
            <div
              key={step.num}
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(45,74,43,0.16)',
                borderRadius: 16,
                padding: '28px 24px',
                display: 'flex', flexDirection: 'column',
                boxShadow:
                  '0 1px 0 rgba(255,255,255,0.8) inset, 0 18px 40px -22px rgba(45,74,43,0.22)',
                transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow =
                  '0 1px 0 rgba(255,255,255,0.8) inset, 0 24px 50px -22px rgba(45,74,43,0.32)';
                e.currentTarget.style.borderColor = 'rgba(212,167,55,0.50)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow =
                  '0 1px 0 rgba(255,255,255,0.8) inset, 0 18px 40px -22px rgba(45,74,43,0.22)';
                e.currentTarget.style.borderColor = 'rgba(45,74,43,0.16)';
              }}
            >
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12, fontWeight: 700,
                  color: '#FFFFFF',
                  letterSpacing: '0.08em',
                  background: '#1F3A1D',
                  border: '1px solid #0F2A0D',
                  borderRadius: 6, padding: '4px 10px',
                  alignSelf: 'flex-start',
                  marginBottom: 22,
                  boxShadow: '0 4px 10px -3px rgba(15,42,13,0.35)',
                }}
              >
                {step.num}
              </span>

              <h3
                style={{
                  fontFamily: 'Fraunces, serif',
                  fontSize: 22, fontWeight: 700,
                  color: '#0F2A0D',
                  margin: '0 0 12px',
                  lineHeight: 1.2,
                  letterSpacing: '-0.018em',
                }}
              >
                {step.title}
              </h3>

              <p
                style={{
                  fontSize: 15,
                  color: '#1F3A1D',
                  lineHeight: 1.6,
                  fontWeight: 500,
                  margin: 0,
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="hiw-mobile" style={{ display: 'none', flexDirection: 'column', gap: 16, maxWidth: 480, margin: '0 auto' }}>
          {STEPS.map((step) => (
            <div
              key={step.num}
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(45,74,43,0.16)',
                borderRadius: 14,
                padding: '22px 22px',
                display: 'flex', gap: 16, alignItems: 'flex-start',
                boxShadow: '0 12px 28px -16px rgba(45,74,43,0.22)',
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12, fontWeight: 700,
                  color: '#FFFFFF',
                  letterSpacing: '0.08em',
                  background: '#1F3A1D',
                  borderRadius: 6, padding: '4px 10px',
                  marginTop: 2,
                }}
              >
                {step.num}
              </span>
              <div>
                <h3
                  style={{
                    fontFamily: 'Fraunces, serif',
                    fontSize: 19, fontWeight: 700,
                    color: '#0F2A0D',
                    margin: '0 0 6px',
                    letterSpacing: '-0.018em',
                  }}
                >
                  {step.title}
                </h3>
                <p style={{ fontSize: 14.5, color: '#2A4226', lineHeight: 1.6, margin: 0, fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <style>{`
          @media (max-width: 1000px) {
            .hiw-desktop { grid-template-columns: 1fr 1fr !important; }
          }
          @media (max-width: 640px) {
            .hiw-desktop { display: none !important; }
            .hiw-mobile { display: flex !important; }
          }
        `}</style>
      </div>
    </section>
  );
}
