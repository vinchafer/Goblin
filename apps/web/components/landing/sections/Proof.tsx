// Proof strip — calm credibility band mirroring the pitch's
// "This isn't a deck. It's a product." beat. Numbers are kept congruent with
// the pitch proof slide (justgoblin.dev/pitch): same repo, same figures.
// No "passing" claim on the E2E suite (it is not asserted green).

const STATS: { value: string; label: string }[] = [
  { value: '622', label: 'commits' },
  { value: '65,000+', label: 'lines' },
  { value: '169', label: 'E2E tests' },
  { value: '9', label: 'providers' },
  { value: '1', label: 'founder' },
];

export function Proof() {
  return (
    <section className="proof">
      <div className="proof-inner">
        <div className="proof-head">
          This isn&apos;t a deck. <span className="serif-italic">It&apos;s a product.</span>
        </div>
        <div className="proof-stats">
          {STATS.map((s, i) => (
            <span key={s.label} style={{ display: 'contents' }}>
              <span className="proof-stat">
                <span className="num">{s.value}</span>
                <span className="lbl">{s.label}</span>
              </span>
              {i < STATS.length - 1 ? <span className="proof-sep" aria-hidden="true" /> : null}
            </span>
          ))}
        </div>
        <p className="proof-foot">
          All of it live today at justgoblin.com. <span className="serif-italic">Poke at every claim.</span>
        </p>
      </div>
    </section>
  );
}
