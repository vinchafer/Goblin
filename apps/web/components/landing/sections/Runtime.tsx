import { Fragment } from 'react';
import { SectionHead } from '@/components/landing/ui/SectionHead';

// LANDING-MESSAGING v2 · §4.1 — the section that answers "what runs where"
// as ONE statement instead of five scattered hints.
//
// WHY THIS EXISTS. The page already carried the correct sentence ("the AI itself
// runs in Goblin's cloud", the old AiLocationNote). A technical reader from the
// first cohort read the page start to finish and still concluded the model runs
// on his phone. Every string was true; the model a reader assembles from order,
// weight and typography was not. Three things caused it:
//
//   L-1  The load-bearing fact wore the page's ORNAMENT signal. Serif-italic is
//        used throughout for headline flourish ("It ships.", "Code anything.").
//        The one structural fact on the page was set in it, so the eye — trained
//        by eleven other sections — read it as decoration and skipped it.
//        Nothing here is serif-italic except the headline's own flourish, which
//        is where that signal belongs.
//   L-2  The loudest signal in the upper page was the provider strip ("BRING YOUR
//        OWN FRONTIER" + seven vendor names), which sat directly under this
//        answer and contradicted it. Seven proper nouns beat body copy every
//        time. It has moved down to Pricing, where BYOK belongs — after the
//        standard path, not instead of it.
//   L-6  Swift + Forge — the actual answer to "so whose model, and who pays for
//        it?" — first appeared at position 10, in plan bullets. A reader confused
//        at position 2 never arrives there. The answer now sits where the
//        question forms.
//
// Unnumbered by decision D-3: numbering this would force all five section labels
// and every anchor to shift, for no reader benefit. It is a strip, like THE AGENT.
//
// The old AiLocationNote section is absorbed here — its sentence survives as the
// GOBLIN card and the home-screen line below the grid, both in plain set.
//
// LANGUAGE NOTE: the marketing landing is a static English page (app/page.tsx —
// there is no i18n mechanism on the landing). Following AgentFlow.tsx, the
// founder-authored German is carried in `de` so it is ready the day the landing
// is localized. It does not render today.

const HEAD = {
  en: { a: 'Your device does nothing.', b: "That's the point." },
  de: { a: 'Dein Gerät macht nichts.', b: 'Genau das ist der Punkt.' },
};

// Three cards, read left to right as the actual path of a build. Schematic, not
// illustrated: mono label, plain-set body. The body sentences are the load-bearing
// ones on this page, so nothing in them is decorated.
const CARDS = [
  {
    key: 'device',
    en: {
      label: 'Your device',
      body: 'A browser. That is the entire requirement. A phone is enough.',
    },
    de: {
      label: 'Dein Gerät',
      body: 'Ein Browser. Mehr braucht es nicht. Ein Handy reicht.',
    },
  },
  {
    key: 'goblin',
    en: {
      label: 'Goblin',
      body: 'Chat, agent, build and publish run on our servers — and so do the AI models. Nothing is downloaded to your device.',
    },
    de: {
      label: 'Goblin',
      body: 'Chat, Agent, Build und Veröffentlichen laufen auf unseren Servern — die KI-Modelle ebenso. Auf dein Gerät wird nichts geladen.',
    },
  },
  {
    key: 'app',
    en: {
      label: 'Your app',
      body: 'Goes live on your own Vercel account, with a real URL. The code stays yours.',
    },
    de: {
      label: 'Deine App',
      body: 'Geht live auf deinem eigenen Vercel-Account, mit echter URL. Der Code bleibt deiner.',
    },
  },
];

// L-10 at the root. The reviewer quoted "install Goblin as an app" — the heading
// of the PWA install card (components/landing/sections/InstallAppBlock.tsx), which
// renders right below this section. "Install" is the word the platforms use and
// cannot be avoided there, so the misreading is disarmed here instead, before the
// card is reached: installing adds an icon, not a runtime.
const INSTALL_NOTE = {
  en: 'Adding Goblin to your home screen only adds an icon. It stays a website: no model, no runtime, nothing else lands on your device.',
  de: 'Goblin zum Home-Bildschirm hinzufügen legt nur ein Icon an. Es bleibt eine Webseite: kein Modell, keine Laufzeit, nichts landet auf deinem Gerät.',
};

// L-6. The mechanism, not the spec sheet. Decision D-1: name the CLASS of model,
// never the vendor — the class is what makes the economics legible to a technical
// reader, while naming the models would commit an outside surface to a white-label
// decision that has not been made. No number appears here, so nothing can drift
// against the CFO dashboard.
const MODELS = {
  en: {
    eyebrow: 'Included in every plan — Goblin Swift & Forge',
    body: 'Two efficient open-weight models, bundled. Per request they cost a fraction of a frontier model — that is why the AI can be part of the plan instead of a second subscription.',
  },
  de: {
    eyebrow: 'In jedem Plan enthalten — Goblin Swift & Forge',
    body: 'Zwei effiziente offene Modelle, gebündelt. Pro Anfrage kosten sie einen Bruchteil eines Frontier-Modells — deshalb kann die KI im Plan enthalten sein statt in einem zweiten Abo.',
  },
};

export function Runtime() {
  return (
    <section id="runtime" className="runtime">
      <div className="container">
        <SectionHead
          label="Where it runs"
          heading={
            <>
              {HEAD.en.a} <span className="serif-italic">{HEAD.en.b}</span>
            </>
          }
        />

        <div className="runtime-grid">
          {CARDS.map((c, i) => (
            <Fragment key={c.key}>
              {i > 0 ? (
                <span className="runtime-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M4 12h15M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ) : null}
              <article className="runtime-card">
                <div className="label">{c.en.label}</div>
                <p>{c.en.body}</p>
              </article>
            </Fragment>
          ))}
        </div>

        <p className="runtime-note">{INSTALL_NOTE.en}</p>

        <div className="runtime-models">
          <div className="runtime-models-eyebrow">{MODELS.en.eyebrow}</div>
          <p>{MODELS.en.body}</p>
        </div>
      </div>
    </section>
  );
}
