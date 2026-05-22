import {
  DeviceMobile,
  ChatCircle,
  Code,
  Terminal,
  GitBranch,
  TriangleDashed,
  BellRinging,
  Globe,
} from '@phosphor-icons/react/dist/ssr';

const STEPS = [
  { Icon: DeviceMobile, label: 'Open Goblin', sub: 'On your phone, tablet, or laptop' },
  { Icon: ChatCircle, label: 'Chat with AI', sub: 'Describe what you want to build' },
  { Icon: Code, label: 'Send to Code', sub: 'One tap. No copy-paste.' },
  { Icon: Terminal, label: 'Build', sub: 'You decide what runs and when' },
  { Icon: GitBranch, label: 'Push to GitHub', sub: 'Automatic, with commit messages' },
  { Icon: TriangleDashed, label: 'Deploy to Vercel', sub: '~34 seconds, every time' },
  { Icon: BellRinging, label: 'Live notification', sub: 'Push to your phone when it ships' },
  { Icon: Globe, label: 'Preview', sub: 'Tap to see your live site' },
];

export function IslandFlow() {
  return (
    <section
      id="island-flow"
      style={{
        background: '#0f2a0d',
        padding: '120px 32px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(232,191,106,0.10) 0%, transparent 55%)',
        }}
      />

      <div
        style={{
          maxWidth: 860,
          margin: '0 auto',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div
            style={{
              fontSize: 11, fontWeight: 700,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: '#F0CF8A',
              marginBottom: 18,
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            The island flow
          </div>
          <h2
            style={{
              fontFamily: 'Fraunces, serif',
              fontSize: 'clamp(36px, 5.2vw, 60px)',
              color: '#FFFFFF',
              lineHeight: 1.05,
              letterSpacing: '-0.025em',
              fontWeight: 600,
              margin: '0 0 18px',
            }}
          >
            From beach to{' '}
            <em style={{ fontStyle: 'italic', color: '#F0CF8A', fontWeight: 500 }}>
              deployed.
            </em>
          </h2>
          <p
            style={{
              fontSize: 17,
              color: 'rgba(247,244,237,0.92)',
              maxWidth: 540, margin: '0 auto',
              lineHeight: 1.6, fontWeight: 500,
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Build your SaaS from Santorini. No laptop. No copy-paste. No token panic.
          </p>
        </div>

        <div style={{ position: 'relative', maxWidth: 580, margin: '0 auto' }}>
          {/* Vertical connector */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 27, top: 30, bottom: 30,
              width: 2,
              background:
                'linear-gradient(180deg, transparent 0%, rgba(232,191,106,0.65) 12%, rgba(232,191,106,0.65) 88%, transparent 100%)',
            }}
          />

          {STEPS.map((s, i) => (
            <div
              key={s.label}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 20,
                marginBottom: i < STEPS.length - 1 ? 30 : 0,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div
                style={{
                  width: 56, height: 56, flexShrink: 0,
                  background: '#1a3a18',
                  border: '1.5px solid rgba(232,191,106,0.55)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow:
                    '0 1px 0 rgba(255,255,255,0.06) inset, 0 6px 18px rgba(0,0,0,0.40)',
                }}
              >
                <s.Icon size={24} weight="duotone" color="#F0CF8A" />
              </div>
              <div style={{ paddingTop: 8 }}>
                <h4
                  style={{
                    fontFamily: 'Fraunces, serif',
                    fontSize: 21, fontWeight: 700,
                    color: '#FFFFFF',
                    margin: 0, marginBottom: 6, lineHeight: 1.2,
                    letterSpacing: '-0.018em',
                  }}
                >
                  {s.label}
                </h4>
                <p
                  style={{
                    color: 'rgba(247,244,237,0.82)',
                    fontSize: 14.5, margin: 0, lineHeight: 1.5,
                    fontFamily: 'DM Sans, sans-serif',
                    fontWeight: 500,
                  }}
                >
                  {s.sub}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 64 }}>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 16,
              fontSize: 13, color: 'rgba(247,244,237,0.65)',
              fontFamily: 'DM Sans, sans-serif',
              fontWeight: 500, letterSpacing: '0.04em',
            }}
          >
            <span style={{ width: 28, height: 1, background: 'rgba(232,191,106,0.40)' }} />
            Works on any device, from anywhere
            <span style={{ width: 28, height: 1, background: 'rgba(232,191,106,0.40)' }} />
          </div>
        </div>
      </div>
    </section>
  );
}
