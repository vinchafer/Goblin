// Trust strip on the public landing (justgoblin.com).
//
// Sprint 12 (fix 1C): the old strip spoke in PITCH/investor voice — "This
// isn't a deck. It's a product.", raw commit/LOC/E2E/founder counts, and
// "Poke at every claim." That is language for investors, not for Max (the
// non-technical builder who lands here). Replaced with a lean, warm trust
// line in the landing's own voice: Goblin is a real, working product you can
// build with today — no numbers to prove, no challenge to issue.
//
// COPY STATUS: DRAFT — pending founder review (Gate 3). DE variant lives in
// the Gate-3 copy package; the landing renders EN today (EN-only surface).

export function Proof() {
  return (
    <section className="proof">
      <div className="proof-inner">
        <div className="proof-head">
          A real product. <span className="serif-italic">Ready to build with today.</span>
        </div>
        <p className="proof-foot">
          Everything here works right now — start building in minutes. No setup, no laptop, no card.
        </p>
      </div>
    </section>
  );
}
