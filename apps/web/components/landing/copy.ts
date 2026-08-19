import type { Lang } from '@/lib/locale';

/**
 * LANDING-MESSAGING v2 · U6 — the landing's copy, both languages, one file.
 *
 * WHY THIS EXISTS. Until U6 the landing was a hardcoded English surface: twelve
 * sections with their strings inline, and the nav's DE·EN control set the
 * language for sign-in and the app while the page under it stayed English. A
 * German reader could switch to DE and watch nothing change. This module makes
 * `/` and `/de` two renderings of one dictionary.
 *
 * TWO RULES THIS FILE ENFORCES BY CONSTRUCTION:
 *
 *  1. NO HALF-TRANSLATION. `LandingCopy` is inferred from the English object, so
 *     the German object cannot compile while a key is missing or misspelled.
 *     Array LENGTHS are not covered by that inference (four cards vs three still
 *     typechecks), so copy.parity.test.ts walks both trees and fails on any
 *     shape difference. Between the two, a partly-translated landing cannot ship.
 *
 *  2. PLAIN STRINGS ONLY — no JSX in here. Headings that carry an ornamental
 *     serif-italic fragment are stored as { a, i, b? }: `a` leads, `i` is the
 *     italic fragment, `b` trails. Whether the parts are separated by a space or
 *     a line break is presentation and stays in the section component. This
 *     keeps the dictionary readable as prose — it can be handed to a translator,
 *     or pasted into a review, without stripping markup first.
 *
 * NUMBERS ARE NOT HERE. Prices, build allowances and storage come from
 * lib/plan-builds.ts and lib/plan-storage.ts, which already take a lang and are
 * the single source for those figures (Dokument-Disziplin: numbers live in one
 * place). This file must never restate one.
 */

type Head = { a: string; i: string; b?: string };

const EN = {
  meta: {
    title: 'Goblin — The cloud workshop for builders',
    description:
      "Everything runs on our servers — the models too. No keys, no setup, no token counter. Tell it what you want, it ships. The cloud workshop for builders who don't wait for a laptop.",
  },

  nav: {
    home: 'Goblin home',
    why: 'Why Goblin',
    how: 'How it works',
    pricing: 'Pricing',
    faq: 'FAQ',
    signIn: 'Sign in',
    start: 'Start building',
  },

  hero: {
    status: 'v1.0 · Now in beta',
    head: { a: 'Tell it what you want.', i: 'It ships.' } as Head,
    // Split around the ornamental fragment; the execution model is in leadA and
    // leadB, both plain set (LANDING-MESSAGING v2 · L-1).
    leadA:
      "The cloud workshop for builders who don't wait for a laptop. Everything runs on our servers; you work in a browser. Describe what you want and the agent builds, verifies, and ships it — you watch every step and",
    leadI: 'take control whenever you like.',
    leadB:
      'The models run on our side too — no keys, no setup, no token counter. Build from any device, push to GitHub, go live on your own Vercel account.',
    ctaPrimary: 'Start building free',
    ctaSecondary: 'See how it works',
    trial: '7-day free trial',
    noCard: 'No credit card required',
  },

  runtime: {
    label: 'Where it runs',
    head: { a: 'Your device does nothing.', i: "That's the point." } as Head,
    cards: [
      {
        label: 'Your device',
        body: "A browser. That's the entire requirement. A phone is enough.",
      },
      {
        label: 'Goblin',
        body: 'Chat, agent, build and publish run on our servers — and so do the AI models. Nothing is downloaded to your device.',
      },
      {
        label: 'Your app',
        body: 'Goes live on your own Vercel account, with a real URL. The code stays yours.',
      },
    ],
    installNote:
      'Adding Goblin to your home screen only adds an icon. It stays a website: no model, no runtime, nothing else lands on your device.',
    // Two parts, not one string: the eyebrow is mono, uppercase and letter-spaced,
    // so at 375px a single run breaks wherever it runs out of room and orphans a
    // word ("… GOBLIN SWIFT &" / "FORGE"). German is ~20% longer and breaks worse.
    // Split at the em-dash, each part unbreakable, and the dash becomes the only
    // wrap point — one tidy line on desktop, two on a phone, in both languages.
    modelsEyebrowA: 'Included in every plan',
    modelsEyebrowB: 'Goblin Swift & Forge',
    modelsBody:
      'Two efficient open-weight models, bundled. Per request they cost a fraction of a frontier model — that is why the AI can be part of the plan instead of a second subscription.',
  },

  trusted: {
    label: 'Power users — bring your own frontier',
  },

  problem: {
    label: 'The Problem',
    head: { a: 'Building with AI', i: "shouldn't feel like this." } as Head,
    lead: 'Four walls every builder hits. Goblin removes all of them.',
    cards: [
      {
        num: 'P · 01',
        title: 'Token panic',
        body: 'Frontier subscriptions cut you off mid-session. You count tokens instead of shipping.',
        fix: 'Bundled, not metered',
      },
      {
        num: 'P · 02',
        title: 'Laptop lock-in',
        body: 'Before you write a line, you need a set-up developer machine. Runtime, toolchain, keys, the lot.',
        fix: 'A browser is the whole requirement',
      },
      {
        num: 'P · 03',
        title: 'Copy-paste hell',
        body: 'Chat, copy, switch, paste, find the file. Every. Single. Time.',
        fix: 'One-tap Send to Code',
      },
      {
        num: 'P · 04',
        title: 'IDE overwhelm',
        body: "Cursor and VS Code weren't built for builders who just want to ship fast.",
        fix: 'Focused builder UI',
      },
    ],
  },

  how: {
    label: 'How it works',
    head: { a: 'Ship in', i: 'four', b: 'steps.' } as Head,
    leadA:
      'Describe what you want and the agent takes it from there — building, verifying, and shipping while you watch. Prefer hands-on?',
    leadI: 'Take control at any step.',
    step: 'Step',
    steps: [
      {
        title: 'Log in from any device',
        body: "Your workshop is always ready. Phone, laptop, tablet — it doesn't matter.",
      },
      {
        title: 'Tell your goblin what to build',
        body: 'Plain English works best. No prompt engineering required.',
      },
      {
        title: 'Send to Code with one tap',
        body: 'AI output lands directly in your editor. No clipboard, no tab juggling.',
      },
      {
        title: 'Push to GitHub and go live',
        body: 'One click publishes to your own Vercel account — you connect it once, and it stays yours.',
      },
    ],
  },

  product: {
    label: 'The product',
    head: { a: 'This is Goblin', i: 'on your phone.' } as Head,
    lead: 'Not a companion app, not a remote desktop. The whole workshop, on the screen you already have with you.',
    paras: [
      {
        strong: 'You start by saying what you want.',
        rest: 'The composer is the same one the desktop uses — pick a model, attach a file, or just type. No prompt engineering, no setup screen first.',
      },
      {
        strong: 'Your projects live here.',
        rest: 'Every one of them opens into chat, code and publishing from this list — the phone is not a viewer for work you did somewhere else.',
      },
      {
        strong: 'This is the real screen',
        rest: ", drawn from the app's own code rather than staged for the page. What you see is what loads after you sign in.",
      },
    ],
  },

  agent: {
    label: 'The agent',
    head: { a: 'Your agent builds it —', i: 'end to end.' } as Head,
    lead: 'You see every step — and take over anytime.',
    step: 'Step',
    steps: [
      { title: 'Plan', body: 'It reads your request and lays out a plan before it touches a single file.' },
      { title: 'Writes the files', body: 'It writes and edits the files in your project directly — not snippets for you to copy.' },
      { title: 'Checks its own work', body: 'It verifies what it built, corrects what it can, and tells you plainly when something is still broken.' },
      { title: 'Goes live', body: 'On your go-ahead it publishes — and confirms the live URL when it is up.' },
    ],
  },

  island: {
    label: 'The island flow',
    head: { a: 'From phone to', i: 'production.' } as Head,
    lead: 'Seven steps from input to a live URL. Whatever device, wherever you are.',
    foot: 'Works on any device, from anywhere',
    steps: [
      { title: 'Open Goblin', body: 'On your phone, tablet, or laptop' },
      { title: 'Chat with AI', body: 'Describe what you want to build' },
      { title: 'Send to Code', body: 'One tap. No copy-paste.' },
      { title: 'Build', body: 'You decide what runs and when' },
      { title: 'Push to GitHub', body: 'Automatic, with commit messages' },
      { title: 'Deploy to your own Vercel', body: 'Connect it once — the app is yours' },
      { title: 'Live notification', body: 'Pushed to your phone when it ships' },
    ],
  },

  proof: {
    head: { a: 'A real product.', i: 'Ready to build with today.' } as Head,
    foot: 'Everything here works right now — start building in minutes. No setup, no laptop, no card.',
  },

  pricing: {
    label: 'Pricing',
    head: { a: 'Simple pricing.', i: 'Build anywhere.' } as Head,
    lead: '7-day free trial. No credit card required. Cancel anytime.',
    recommended: 'Recommended',
    cta: 'Start free trial',
    note: 'BYOK users bring their own API keys · Goblin charges $0 extra for inference · Secure checkout via Stripe',
    plans: [
      { label: 'Build', tagline: 'Start free, ship fast.' },
      { label: 'Pro', tagline: 'For shipping serious projects.' },
      { label: 'Power', tagline: 'For builders who never stop.' },
    ],
    perMonth: '/ month',
    features: {
      bundled: 'Goblin Swift + Forge included — no key, no token counter',
      projects: 'Unlimited projects',
      byok: 'Bring your own keys too — every major provider, $0 Goblin margin',
      github: 'GitHub push integration',
      anyDevice: 'Build from any device',
    },
  },

  faq: {
    label: 'FAQ',
    head: { a: 'Questions your goblin', i: 'anticipated.' } as Head,
    items: [
      {
        q: 'Do I need to know how to code?',
        a: "No. But if you do know how to code, you'll love Goblin even more. We show you every line we write and let you edit directly.",
      },
      {
        q: 'Can I use my own Claude or OpenAI keys?',
        a: 'Yes. Go to Settings → API Keys and paste your key. We encrypt it at rest and use it exclusively for your requests. No markup, no middleman.',
      },
      {
        q: 'What AI models can I use?',
        a: "Two Goblin models are built into every plan — Goblin Swift (fast, efficient) and Goblin Forge (for heavier work). For what most builders ship, that's more than enough model. No API key, no per-token counter. And if you ever want the absolute frontier, it's one tap away: bring your own Anthropic, OpenAI, Google, xAI, Mistral, or DeepSeek key — Goblin takes no margin on it.",
      },
      {
        q: 'What happens after my trial?',
        a: "7 days free, no card required. After that you'll see an upgrade prompt. Your projects are always safe. If you don't upgrade, you can still log in, download your code, and push to GitHub.",
      },
      {
        q: 'Is my code private?',
        a: 'Yes. Your projects are only visible to you, stored encrypted at rest in the EU. We never train on your data.',
      },
      {
        q: 'Can I use Goblin on my phone?',
        a: "Yes. That's the whole point. Build from your bed. Build from the train. Build from wherever you happen to be.",
      },
    ],
  },

  outro: {
    tagline: { a: 'Build anywhere.', i: 'Code anything.' } as Head,
    why: 'Built by one person in Switzerland, for everyone who hit the same walls: subscriptions priced for San Francisco, and tools that assume a set-up developer machine. Goblin assumes a browser. It is for the rest of the planet.',
    whyLink: 'Read the manifesto',
    cta: 'Start building free',
    foot: 'Now in beta · Made in Switzerland',
  },

  footer: {
    product: 'Product',
    company: 'Company',
    legal: 'Legal',
    pricing: 'Pricing',
    faq: 'FAQ',
    changelog: 'Changelog',
    about: 'About',
    manifesto: 'Manifesto',
    terms: 'Terms',
    acceptableUse: 'Acceptable Use',
    privacy: 'Privacy',
    imprint: 'Imprint',
    copyright: '© 2026 · Goblin Inc. · Made in Switzerland',
    end: 'Build anywhere · Code anything',
  },

  /**
   * The phone mock. Every string here is quoted VERBATIM from the app's own
   * language branch — the section above it claims "this is the real screen,
   * drawn from the app's own code", and a freshly-translated mock would make
   * that claim false in German. Sources: app/dashboard/page.tsx (greeting,
   * headline, QUICK_PROMPTS_*, UPDATES, statusLabel, timeAgo, section titles)
   * and components/chat/ChatInput.tsx (placeholder, new-line hint).
   */
  phone: {
    mode: 'Chat',
    greeting: 'Good morning, Marie',
    head: { a: 'Tell Goblin what you want', i: 'to build.' } as Head,
    placeholder: 'A landing page with Stripe checkout in Next.js…',
    model: 'Goblin Swift',
    newLine: '⇧↵ new line',
    quickPrompts: [
      'A landing page with a sign-up form',
      'A to-do list that remembers my entries',
      'A page where people can book appointments',
      'Magic-link login for my Next.js app',
    ],
    projectsTitle: 'Your projects',
    active: '3 ACTIVE',
    newProject: '+ New project',
    ago: ['2 MIN AGO', '3 DAYS AGO', '1 MONTH AGO'],
    whatsNew: "What's new",
    helpFaq: 'Help & FAQ →',
    updates: [
      {
        title: 'Claude Sonnet 4.6 available',
        desc: 'Goblin automatically uses your own Anthropic account.',
        date: 'MAY 22',
      },
      {
        title: 'BYOK streaming stabilized',
        desc: 'Anthropic, OpenAI, and Groq stream again without interruptions.',
        date: 'MAY 20',
      },
      {
        title: 'Send to Code on mobile',
        desc: 'Push code from chat into the editor — works on the go too.',
        date: 'APR 14',
      },
    ],
  },
};

/** The shape both languages must satisfy. Inferred, so EN is the schema. */
export type LandingCopy = typeof EN;

const DE: LandingCopy = {
  meta: {
    title: 'Goblin — Die Cloud-Werkstatt für Macher',
    description:
      'Alles läuft auf unseren Servern — die Modelle auch. Keine Keys, kein Setup, kein Token-Zähler. Sag, was du willst, und es geht live. Die Cloud-Werkstatt für alle, die nicht auf einen Laptop warten.',
  },

  nav: {
    home: 'Goblin Startseite',
    why: 'Warum Goblin',
    how: 'So funktioniert es',
    pricing: 'Preise',
    faq: 'FAQ',
    signIn: 'Anmelden',
    start: 'Loslegen',
  },

  hero: {
    status: 'v1.0 · Jetzt in Beta',
    head: { a: 'Sag, was du willst.', i: 'Es geht live.' },
    leadA:
      'Die Cloud-Werkstatt für alle, die nicht auf einen Laptop warten. Alles läuft auf unseren Servern; du arbeitest im Browser. Beschreib, was du willst — der Agent baut, prüft und veröffentlicht es, du siehst jeden Schritt und',
    leadI: 'übernimmst jederzeit.',
    leadB:
      'Auch die Modelle laufen bei uns — keine Keys, kein Setup, kein Token-Zähler. Bau von jedem Gerät, push zu GitHub, geh live auf deinem eigenen Vercel-Account.',
    ctaPrimary: 'Kostenlos loslegen',
    ctaSecondary: 'So funktioniert es',
    trial: '7 Tage kostenlos',
    noCard: 'Keine Kreditkarte nötig',
  },

  runtime: {
    label: 'Wo es läuft',
    head: { a: 'Dein Gerät macht nichts.', i: 'Genau das ist der Punkt.' },
    cards: [
      {
        label: 'Dein Gerät',
        body: 'Ein Browser. Mehr braucht es nicht. Ein Handy reicht.',
      },
      {
        label: 'Goblin',
        body: 'Chat, Agent, Build und Veröffentlichen laufen auf unseren Servern — die KI-Modelle ebenso. Auf dein Gerät wird nichts geladen.',
      },
      {
        label: 'Deine App',
        body: 'Geht live auf deinem eigenen Vercel-Account, mit echter URL. Der Code bleibt deiner.',
      },
    ],
    installNote:
      'Goblin zum Home-Bildschirm hinzuzufügen legt nur ein Icon an. Es bleibt eine Webseite: kein Modell, keine Laufzeit, nichts landet auf deinem Gerät.',
    modelsEyebrowA: 'In jedem Plan enthalten',
    modelsEyebrowB: 'Goblin Swift & Forge',
    modelsBody:
      'Zwei effiziente offene Modelle, gebündelt. Pro Anfrage kosten sie einen Bruchteil eines Frontier-Modells — deshalb kann die KI im Plan enthalten sein statt in einem zweiten Abo.',
  },

  trusted: {
    label: 'Power-User — bring dein eigenes Frontier-Modell mit',
  },

  problem: {
    label: 'Das Problem',
    head: { a: 'Mit KI bauen', i: 'sollte sich nicht so anfühlen.' },
    lead: 'Vier Wände, gegen die jeder läuft. Goblin räumt alle vier weg.',
    cards: [
      {
        num: 'P · 01',
        title: 'Token-Panik',
        body: 'Frontier-Abos schneiden dich mitten in der Arbeit ab. Du zählst Tokens, statt zu bauen.',
        fix: 'Enthalten, nicht getaktet',
      },
      {
        num: 'P · 02',
        title: 'Laptop-Zwang',
        body: 'Bevor du eine Zeile schreibst, brauchst du einen eingerichteten Entwicklerrechner. Laufzeit, Toolchain, Keys, alles.',
        fix: 'Ein Browser genügt',
      },
      {
        num: 'P · 03',
        title: 'Copy-Paste-Hölle',
        body: 'Chatten, kopieren, wechseln, einfügen, Datei suchen. Jedes. Einzelne. Mal.',
        fix: 'Send to Code mit einem Tipp',
      },
      {
        num: 'P · 04',
        title: 'IDE-Überforderung',
        body: 'Cursor und VS Code sind nicht für Leute gebaut, die einfach schnell etwas fertig bekommen wollen.',
        fix: 'Aufgeräumte Bau-Oberfläche',
      },
    ],
  },

  how: {
    label: 'So funktioniert es',
    head: { a: 'In', i: 'vier', b: 'Schritten live.' },
    leadA:
      'Beschreib, was du willst — den Rest übernimmt der Agent: bauen, prüfen, veröffentlichen, während du zusiehst. Lieber selbst Hand anlegen?',
    leadI: 'Übernimm bei jedem Schritt.',
    step: 'Schritt',
    steps: [
      {
        title: 'Von jedem Gerät anmelden',
        body: 'Deine Werkstatt steht immer bereit. Handy, Laptop, Tablet — egal.',
      },
      {
        title: 'Sag deinem Goblin, was er bauen soll',
        body: 'Normale Sprache reicht. Kein Prompt-Engineering nötig.',
      },
      {
        title: 'Mit einem Tipp zu Send to Code',
        body: 'Was die KI schreibt, landet direkt im Editor. Keine Zwischenablage, kein Tab-Jonglieren.',
      },
      {
        title: 'Zu GitHub pushen und live gehen',
        body: 'Ein Klick veröffentlicht auf deinem eigenen Vercel-Account — einmal verbinden, und er bleibt deiner.',
      },
    ],
  },

  product: {
    label: 'Das Produkt',
    head: { a: 'Das ist Goblin', i: 'auf deinem Handy.' },
    lead: 'Keine Begleit-App, kein Remote-Desktop. Die ganze Werkstatt, auf dem Bildschirm, den du ohnehin dabei hast.',
    paras: [
      {
        strong: 'Du fängst an, indem du sagst, was du willst.',
        rest: 'Das Eingabefeld ist dasselbe wie am Desktop — Modell wählen, Datei anhängen oder einfach tippen. Kein Prompt-Engineering, kein Einrichtungs-Bildschirm vorweg.',
      },
      {
        strong: 'Deine Projekte leben hier.',
        rest: 'Jedes davon öffnet aus dieser Liste heraus Chat, Code und Veröffentlichen — das Handy ist kein Betrachter für Arbeit, die du woanders gemacht hast.',
      },
      {
        strong: 'Das ist der echte Bildschirm',
        rest: ', gezeichnet aus dem Code der App selbst statt für die Seite gestellt. Was du siehst, ist das, was nach dem Anmelden lädt.',
      },
    ],
  },

  agent: {
    label: 'Der Agent',
    head: { a: 'Dein Agent baut es —', i: 'von Anfang bis Ende.' },
    lead: 'Du siehst jeden Schritt — und übernimmst jederzeit.',
    step: 'Schritt',
    steps: [
      { title: 'Plan', body: 'Es liest deine Anfrage und legt einen Plan fest, bevor es eine einzige Datei anfasst.' },
      { title: 'Schreibt Dateien', body: 'Es schreibt und ändert die Dateien in deinem Projekt direkt — keine Schnipsel zum Kopieren.' },
      { title: 'Prüft die eigene Arbeit', body: 'Es prüft, was es gebaut hat, korrigiert, was es kann — und sagt klar, wenn etwas kaputt bleibt.' },
      { title: 'Stellt live', body: 'Auf dein Okay stellt es live — und bestätigt die Live-URL, sobald sie steht.' },
    ],
  },

  island: {
    label: 'Der Insel-Ablauf',
    head: { a: 'Vom Handy in die', i: 'Produktion.' },
    lead: 'Sieben Schritte von der Eingabe zur Live-URL. Welches Gerät auch immer, wo auch immer du bist.',
    foot: 'Funktioniert auf jedem Gerät, von überall',
    steps: [
      { title: 'Goblin öffnen', body: 'Auf dem Handy, Tablet oder Laptop' },
      { title: 'Mit der KI chatten', body: 'Beschreib, was du bauen willst' },
      { title: 'Send to Code', body: 'Ein Tipp. Kein Copy-Paste.' },
      { title: 'Bauen', body: 'Du entscheidest, was läuft und wann' },
      { title: 'Zu GitHub pushen', body: 'Automatisch, mit Commit-Nachrichten' },
      { title: 'Auf dein eigenes Vercel deployen', body: 'Einmal verbinden — die App gehört dir' },
      { title: 'Live-Benachrichtigung', body: 'Kommt aufs Handy, sobald es steht' },
    ],
  },

  proof: {
    head: { a: 'Ein echtes Produkt.', i: 'Heute schon einsatzbereit.' },
    foot: 'Alles hier funktioniert jetzt — in Minuten loslegen. Kein Setup, kein Laptop, keine Karte.',
  },

  pricing: {
    label: 'Preise',
    head: { a: 'Einfache Preise.', i: 'Bau von überall.' },
    lead: '7 Tage kostenlos. Keine Kreditkarte nötig. Jederzeit kündbar.',
    recommended: 'Empfohlen',
    cta: 'Kostenlos testen',
    note: 'BYOK-Nutzer bringen eigene API-Keys mit · Goblin verlangt $0 Aufschlag auf Inferenz · Sichere Zahlung über Stripe',
    plans: [
      { label: 'Build', tagline: 'Kostenlos anfangen, schnell liefern.' },
      { label: 'Pro', tagline: 'Für ernsthafte Projekte.' },
      { label: 'Power', tagline: 'Für alle, die nie aufhören.' },
    ],
    perMonth: '/ Monat',
    features: {
      bundled: 'Goblin Swift + Forge enthalten — kein Key, kein Token-Zähler',
      projects: 'Unbegrenzte Projekte',
      byok: 'Eigene Keys gehen auch — jeder grosse Anbieter, $0 Goblin-Marge',
      github: 'GitHub-Push-Integration',
      anyDevice: 'Von jedem Gerät bauen',
    },
  },

  faq: {
    label: 'FAQ',
    head: { a: 'Fragen, die dein Goblin', i: 'vorausgesehen hat.' },
    items: [
      {
        q: 'Muss ich programmieren können?',
        a: 'Nein. Aber wenn du programmieren kannst, wirst du Goblin noch mehr mögen. Wir zeigen dir jede Zeile, die wir schreiben, und lassen dich direkt bearbeiten.',
      },
      {
        q: 'Kann ich meine eigenen Claude- oder OpenAI-Keys nutzen?',
        a: 'Ja. Geh zu Einstellungen → API-Keys und füg deinen Key ein. Wir verschlüsseln ihn im Ruhezustand und nutzen ihn ausschliesslich für deine Anfragen. Kein Aufschlag, kein Zwischenhändler.',
      },
      {
        q: 'Welche KI-Modelle kann ich nutzen?',
        a: 'Zwei Goblin-Modelle sind in jedem Plan eingebaut — Goblin Swift (schnell, effizient) und Goblin Forge (für schwerere Arbeit). Für das, was die meisten bauen, ist das mehr als genug Modell. Kein API-Key, kein Token-Zähler. Und wenn du doch mal das absolute Frontier willst, ist es einen Tipp entfernt: bring deinen eigenen Anthropic-, OpenAI-, Google-, xAI-, Mistral- oder DeepSeek-Key mit — Goblin nimmt darauf keine Marge.',
      },
      {
        q: 'Was passiert nach meiner Testphase?',
        a: '7 Tage kostenlos, keine Karte nötig. Danach siehst du einen Upgrade-Hinweis. Deine Projekte sind immer sicher. Wenn du nicht upgradest, kannst du dich weiterhin anmelden, deinen Code herunterladen und zu GitHub pushen.',
      },
      {
        q: 'Ist mein Code privat?',
        a: 'Ja. Deine Projekte sind nur für dich sichtbar und werden verschlüsselt in der EU gespeichert. Wir trainieren nie auf deinen Daten.',
      },
      {
        q: 'Kann ich Goblin auf dem Handy nutzen?',
        a: 'Ja. Genau darum geht es. Bau aus dem Bett. Bau aus dem Zug. Bau von da, wo du gerade bist.',
      },
    ],
  },

  outro: {
    tagline: { a: 'Bau von überall.', i: 'Programmier alles.' },
    why: 'Von einer Person in der Schweiz gebaut, für alle, die an dieselben Wände gelaufen sind: Abos mit San-Francisco-Preisen und Werkzeuge, die einen fertig eingerichteten Entwicklerrechner voraussetzen. Goblin setzt einen Browser voraus. Für den Rest des Planeten.',
    whyLink: 'Das Manifest lesen',
    cta: 'Kostenlos loslegen',
    foot: 'Jetzt in Beta · Made in Switzerland',
  },

  footer: {
    product: 'Produkt',
    company: 'Unternehmen',
    legal: 'Rechtliches',
    pricing: 'Preise',
    faq: 'FAQ',
    changelog: 'Änderungen',
    about: 'Über uns',
    manifesto: 'Manifest',
    terms: 'AGB',
    acceptableUse: 'Nutzungsregeln',
    privacy: 'Datenschutz',
    imprint: 'Impressum',
    copyright: '© 2026 · Goblin Inc. · Made in Switzerland',
    end: 'Bau von überall · Programmier alles',
  },

  phone: {
    mode: 'Chat',
    greeting: 'Guten Morgen, Marie',
    head: { a: 'Sag Goblin, was du', i: 'bauen willst.' },
    placeholder: 'Eine Landingpage mit Stripe-Bezahlung in Next.js…',
    model: 'Goblin Swift',
    newLine: '⇧↵ neue Zeile',
    quickPrompts: [
      'Eine Landingpage mit Anmeldeformular',
      'Eine Aufgabenliste, die meine Einträge merkt',
      'Eine Seite, auf der Leute Termine buchen können',
      'Magic-Link-Login für meine Next.js-App',
    ],
    projectsTitle: 'Deine Projekte',
    active: '3 AKTIV',
    newProject: '+ Neues Projekt',
    ago: ['VOR 2 MIN', 'VOR 3 TAGEN', 'VOR 1 MONAT'],
    whatsNew: 'Was ist neu',
    helpFaq: 'Hilfe & FAQ →',
    updates: [
      {
        title: 'Claude Sonnet 4.6 verfügbar',
        desc: 'Goblin nutzt dein eigenes Anthropic-Konto automatisch.',
        date: 'MAI 22',
      },
      {
        title: 'BYOK-Streaming stabilisiert',
        desc: 'Anthropic, OpenAI und Groq streamen wieder ohne Abbrüche.',
        date: 'MAI 20',
      },
      {
        title: 'Send to Code auf dem Handy',
        desc: 'Code aus dem Chat in den Editor schieben — funktioniert auch unterwegs.',
        date: 'APR 14',
      },
    ],
  },
};

export const LANDING_COPY: Record<Lang, LandingCopy> = { en: EN, de: DE };

/** The copy for one landing surface. */
export function copy(lang: Lang): LandingCopy {
  return LANDING_COPY[lang];
}

/** `/` is English, `/de` is German — the landing's only two surfaces. */
export function landingPath(lang: Lang): string {
  return lang === 'de' ? '/de' : '/';
}
