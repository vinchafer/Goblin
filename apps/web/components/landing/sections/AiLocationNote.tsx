// TESTER-FEEDBACK (2026-08-17) — "where does the LLM actually run?"
//
// An expert tester read "Install Goblin as an app", "build from everywhere" and
// the manifesto line about San-Francisco-priced subscriptions, and concluded the
// model runs LOCALLY on his device. He then could not work out which LLM runs
// where, or how that would be affordable — his words: "the messaging goes in too
// many directions and creates uncertainty."
//
// Nothing on the page said otherwise, so this line does. It sits directly under
// the install block, because that is where the wrong idea forms: installing
// Goblin to the home screen installs the WORKSHOP, not the model.
//
// Placed as a sibling of InstallAppBlock rather than inside it on purpose —
// that block hides itself once Goblin is installed as a PWA, and this answer
// must not disappear with it.
//
// Deliberately not a spec dump: no model names, no provider, no region. The
// FAQ answers "which models" already, and naming a provider here would be a
// claim this section would have to keep true forever.

export function AiLocationNote() {
  return (
    <section className="ai-location" aria-label="Where the AI runs">
      <p className="ai-location-line">
        Installing Goblin puts the workshop on your home screen —{' '}
        <span className="serif-italic">the AI itself runs in Goblin&apos;s cloud.</span> Your phone
        is the remote control, not the server. Nothing to download, nothing your
        device has to be powerful enough for.
      </p>
    </section>
  );
}
