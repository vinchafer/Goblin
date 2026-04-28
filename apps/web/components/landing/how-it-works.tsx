export function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Log in from any device',
      desc: 'Your workshop is always ready. Phone, laptop, tablet — it doesn\'t matter.'
    },
    {
      num: '02',
      title: 'Tell your goblin what to build',
      desc: 'Plain english works best. No prompt engineering required.'
    },
    {
      num: '03',
      title: 'Send to Code with one tap',
      desc: 'AI output lands directly in your editor. No clipboard, no switching tabs.'
    },
    {
      num: '04',
      title: 'Push to GitHub and go live',
      desc: 'One click publish. Your code, your repo, your deployment.'
    }
  ];

  return (
    <section id="how-it-works" style={{ background: 'var(--cream)', padding: '100px 40px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h2 style={{
          fontFamily: 'Fraunces, serif', fontWeight: 700, textAlign: 'center',
          marginBottom: 72, fontSize: 'clamp(28px, 4vw, 44px)',
          color: 'var(--moss)', letterSpacing: '-1.5px',
        }}>
          Ship in <em style={{ fontStyle: 'italic', color: 'var(--ochre)' }}>four</em> steps.
        </h2>

        {/* Desktop: 4-column with arrows */}
        <div className="hiw-desktop" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0, alignItems: 'start' }}>
          {steps.map((step, i) => (
            <div key={step.num} style={{ textAlign: 'center', position: 'relative', padding: '0 20px' }}>
              {/* Arrow connector between steps */}
              {i < steps.length - 1 && (
                <div style={{
                  position: 'absolute', top: 24, left: '100%', width: '100%',
                  height: 2, background: 'linear-gradient(90deg, #c9933a 0%, #e4ddd2 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  zIndex: 0,
                }}>
                  <span style={{
                    fontSize: 18, color: '#c9933a', position: 'absolute', right: 8, top: -9,
                  }}>→</span>
                </div>
              )}
              
              {/* Big number */}
              <div style={{
                fontFamily: 'Fraunces, serif', fontSize: 56, fontWeight: 900,
                color: '#c9933a', lineHeight: 1, letterSpacing: '-3px',
                marginBottom: 12, position: 'relative', zIndex: 1,
              }}>
                {step.num}
              </div>

              {/* Title */}
              <h3 style={{
                fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 700,
                color: 'var(--moss)', marginBottom: 8, lineHeight: 1.2,
              }}>
                {step.title}
              </h3>

              {/* Description */}
              <p style={{
                fontSize: 13, color: 'var(--meta)', lineHeight: 1.6,
                fontWeight: 300, maxWidth: 200, margin: '0 auto',
              }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Mobile: vertical stack */}
        <div className="hiw-mobile" style={{ display: 'none', flexDirection: 'column', gap: 32 }}>
          {steps.map(step => (
            <div key={step.num} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                fontFamily: 'Fraunces, serif', fontSize: 36, fontWeight: 900,
                color: '#c9933a', lineHeight: 1, flexShrink: 0, minWidth: 40,
              }}>
                {step.num}
              </div>
              <div>
                <h3 style={{
                  fontFamily: 'DM Sans, sans-serif', fontSize: 16, fontWeight: 700,
                  color: 'var(--moss)', marginBottom: 4,
                }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--meta)', lineHeight: 1.6, fontWeight: 300 }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <style>{`
          @media (max-width: 768px) {
            .hiw-desktop { display: none !important; }
            .hiw-mobile { display: flex !important; }
          }
        `}</style>
      </div>
    </section>
  );
}