'use client';

// Minimal i18n for the onboarding flow (Sprint 10.10 — Phase A).
// The marketing landing is English; the APP (everything after the Step-0
// language choice) renders in the language the user picked at Step 0 and we
// persisted to localStorage('goblin:preferred-lang') + users.preferred_lang.
//
// A typed strings map keyed by lang — no heavy i18n library. Every onboarding
// string lives here in BOTH `de` and `en`. Acceptance: pick DE → every word is
// German; pick EN → every word is English. Zero mixing within a screen.
//
// HERO BRANCH: Phase 0.1's live prod truth-test proved a no-key generation
// FAILS today (default model returns "missing a valid AI key"). Per Rule 1 we
// therefore ship HERO-B — the honest, no-promise version. Do NOT switch to a
// "no key needed to start" hero until a real no-key pool is proven.

import { useEffect, useState } from 'react';
import type { PreferredLang } from './onboarding-state';

export type Lang = PreferredLang; // 'en' | 'de'

const LS_KEY = 'goblin:preferred-lang';

// Read the persisted language on the client. SSR renders the `de` default
// (matches the Step-0 default), the client corrects on mount. State-based so
// there is no hydration mismatch — only a one-frame correction if EN was set.
export function useOnbLang(): Lang {
  const [lang, setLang] = useState<Lang>('de');
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(LS_KEY);
      if (v === 'en' || v === 'de') setLang(v);
    } catch {
      /* ignore — keep default */
    }
  }, []);
  return lang;
}

export function readOnbLang(): Lang {
  try {
    const v = window.localStorage.getItem(LS_KEY);
    if (v === 'en' || v === 'de') return v;
  } catch {
    /* ignore */
  }
  return 'de';
}

type Dict = typeof STR['de'];

export const STR: Record<Lang, {
  chrome: { step: string; of: string; help: string };
  // Step 0 — language
  lang: { eyebrow: string; title: string; hint: string; cta: string };
  // Step 1 — hero (HERO-B)
  step1: {
    eyebrow: string; titleA: string; titleB: string; lead: string;
    bullets: string[];
    pathBBadge: string; pathBNum: string; pathBTime: string;
    pathBTitle: string; pathBBody: string; pathBTags: string[]; pathBArr: string;
    pathANum: string; pathATime: string; pathATitle: string; pathABody: string;
    pathATag: string; pathAArr: string;
    explore: string; exploreLink: string; exploreTail: string;
  };
  // Step 2 — layers / how Goblin works
  layers: {
    back: string; eyebrow: string; titleA: string; titleB: string; lead: string;
    items: { tag: string; badge: string; title: string; body: string }[];
    l3cta: string; waitlistIdle: string; waitlistBusy: string; waitlistDone: string;
    flow: { prompt: string; l1: string; l2: string; l3: string };
    flowCap: string;
    continue: string; skip: string;
    footChange: string; footNext: string;
  };
  // Step 3 — provider
  provider: {
    back: string; eyebrow: string; titleA: string; titleB: string; lead: string;
    fallbackTitle: string; fallbackBody: string; fallbackTag: string;
    recommended: string; startSetup: string; connect: string;
    proNoteTitle: string; proNoteBody: string;
    powerBadge: string; customTitle: string; customBody: string; customPrice: string;
    addEndpoint: string;
    whereKey: string; baseUrlLabel: string; pasteKeyLabel: string;
    securityNote: string; testConn: string; testing: string;
    connectedMsg: string; continueLabel: string; addAnother: string; savedAddAnother: string;
    pasteFirst: string; baseRequired: string; invalidKey: string;
    footKeys: string; footSkip: string;
  };
  // Step 4 — tools
  tools: {
    back: string; eyebrow: string; titleA: string; titleB: string; lead: string;
    presetIndieL: string; presetIndieName: string; presetIndieDesc: string;
    presetStarterL: string; presetStarterName: string; presetStarterDesc: string;
    presetAllL: string; presetAllName: string; presetAllDesc: string;
    chatTitle: string; chatSub: string; codeTitle: string; codeSub: string;
    on: string; of: string; recapEnabled: string; recapSub: string;
    chat: string; coding: string; continueLabel: string;
    footChange: string; footSkip: string;
    beta: string; soon: string;
  };
  // Step 5 — integrations
  integ: {
    back: string; eyebrow: string; titleA: string; titleB: string; lead: string;
    sec1num: string; sec1title: string; sec1desc: string;
    sec2num: string; sec2title: string; sec2desc: string;
    sec3num: string; sec3title: string;
    githubDesc: string; connectGithub: string; connecting: string;
    ownTitle: string; ownBody: string; ownCta: string;
    vercelDesc: string; addVercel: string; vercelTokenLabel: string;
    saveToken: string; saving: string; connected: string;
    recommended: string; soon: string;
    mobileTitle: string; mobileBody: string; copyLink: string; linkCopied: string;
    summaryEyebrow: string; summaryTitle: string; summaryBody: string;
    startBuilding: string; skipAll: string;
    footAdd: string; finish: string;
  };
}> = {
  de: {
    chrome: { step: 'SCHRITT', of: 'VON', help: 'HILFE' },
    lang: {
      eyebrow: 'Schritt 00 · Sprache',
      title: 'Willkommen bei Goblin',
      hint: 'Du kannst das jederzeit in den Einstellungen ändern.',
      cta: 'Weiter',
    },
    step1: {
      eyebrow: 'Werkstatt einrichten',
      titleA: 'Wie soll Goblin',
      titleB: 'mit der KI sprechen?',
      lead:
        'Du wählst, wie weit du gehst. Die meisten starten kostenlos mit einem '
        + 'Free-Key und legen später drauf — wenn überhaupt.',
      bullets: [
        'BYOK — Anthropic, OpenAI, Google, Groq',
        'Keine Karte nötig. Jederzeit kündbar.',
        'Deine Keys liegen verschlüsselt in deinem Account.',
      ],
      pathBBadge: 'EMPFOHLEN',
      pathBNum: 'WEG B', pathBTime: '~ 2 MIN',
      pathBTitle: 'Ich bin neu hier.',
      pathBBody:
        'Noch kein Key? Wir holen mit dir einen kostenlosen — keine Karte, kein Fachjargon.',
      pathBTags: ['GEFÜHRT', 'KOSTENLOS'],
      pathBArr: 'Zeig mir, wie',
      pathANum: 'WEG A', pathATime: '~ 60 SEK',
      pathATitle: 'Ich habe schon einen Key.',
      pathABody:
        'Anthropic, OpenAI, Google, Groq und mehr — einfügen, testen, loslegen.',
      pathATag: 'EINFÜGEN & LOS',
      pathAArr: 'Weiter',
      explore: 'Nur schauen? ', exploreLink: 'Erst erkunden',
      exploreTail: ' — ohne Key, mit weichen Limits.',
    },
    layers: {
      back: 'Zurück',
      eyebrow: 'Schritt 02 von 06 — Wie Goblin deine Prompts routet',
      titleA: 'Wie Goblin', titleB: 'arbeitet.',
      lead:
        'Drei Ebenen. Du entscheidest, wie weit nach oben du willst. Die meisten '
        + 'starten auf Ebene 1 und bleiben dort.',
      items: [
        {
          tag: 'Ebene 1', badge: 'AKTIV',
          title: 'Kostenlos starten',
          body:
            'Verbinde einen kostenlosen Key (z.B. Groq) — Goblin macht den Rest. '
            + 'In unter einer Minute startklar. Hier starten die meisten und bleiben.',
        },
        {
          tag: 'Ebene 2', badge: 'BALD',
          title: 'Größere Modelle, ohne eigenen Key',
          body:
            'Bald laufen Goblins eigene Modelle direkt — kein Key, kein Token-Stress, '
            + 'keine Limits. Genau das macht Goblin mehr als einen Key-Manager.',
        },
        {
          tag: 'Ebene 3', badge: 'OPTIONAL',
          title: 'Premium, dein eigener Key',
          body:
            'Für die härtesten Builds: deine bezahlten Provider. Goblin routet '
            + 'dorthin, wenn du willst — oder immer, wenn du es als Standard setzt.',
        },
      ],
      l3cta: 'Premium-Provider hinzufügen',
      waitlistIdle: 'Auf die Liste', waitlistBusy: 'Trag dich ein…',
      waitlistDone: 'Du bist auf der Liste',
      flow: { prompt: 'Prompt', l1: 'Ebene 1 · Standard', l2: 'Ebene 2 · bald', l3: 'Ebene 3 · wenn du willst' },
      flowCap: 'Routing jederzeit änderbar in Einstellungen → Routing.',
      continue: 'Weiter — Provider wählen', skip: 'Überspringen — Standard nutzen',
      footChange: 'JEDERZEIT ÄNDERBAR · EINSTELLUNGEN / ROUTING',
      footNext: 'WEITER — PROVIDER →',
    },
    provider: {
      back: '← Zurück zu „Wie Goblin arbeitet“',
      eyebrow: 'Schritt 03 von 06 — Provider wählen',
      titleA: 'Wähl deinen KI-', titleB: 'Provider.',
      lead:
        'Sechs Provider, drei Muster: kostenloser Tarif, nutzungsbasiert und '
        + 'schnelle Inferenz. Starte mit Groq — Goblin macht den Rest.',
      fallbackTitle: 'Einen wählen. Alle sechs bekommen.',
      fallbackBody:
        'Wenn dein Provider ein Limit erreicht oder Fehler wirft, wechselt Goblin '
        + 'still zum nächsten in deiner Kette — sofort, ohne verlorene Nachrichten.',
      fallbackTag: 'AUTO-FALLBACK · IN EINSTELLUNGEN ANPASSEN',
      recommended: 'EMPFOHLEN · KOSTENLOS', startSetup: 'Einrichten', connect: 'Verbinden',
      proNoteTitle: 'Claude Pro oder ChatGPT Plus?',
      proNoteBody:
        ' Dein Abo gilt nur für die Anbieter-Webseite — hier brauchst du den '
        + 'API-Schlüssel der Firma, den holst du dir separat. Oft günstiger als '
        + 'ein Pro-Abo, vor allem wenn du Goblin nur ab und zu nutzt.',
      powerBadge: 'POWER-USER · ALLE FRONTIER-MODELLE',
      customTitle: 'Ein Key, jedes Modell',
      customBody:
        'Fireworks, Together, OpenRouter, Perplexity — oder jeder OpenAI-kompatible '
        + 'Endpunkt. Nutzungsbasiert. Llama, Mixtral, Qwen, DeepSeek und mehr mit '
        + 'einem einzigen Key.',
      customPrice: 'AB ~$0,10 / M TOKENS', addEndpoint: 'Endpunkt hinzufügen',
      whereKey: 'Wo bekomme ich diesen Key?',
      baseUrlLabel: 'Base-URL', pasteKeyLabel: 'API-Schlüssel einfügen',
      securityNote:
        'Verschlüsselt im Moment des Einfügens. Goblin loggt ihn nie, zeigt ihn nie im Chat.',
      testConn: 'Verbindung testen', testing: 'Teste…',
      connectedMsg: 'Verbunden. {p} ist bereit.',
      continueLabel: 'Weiter', addAnother: 'Noch einen Provider hinzufügen',
      savedAddAnother: 'Key gespeichert ✓ — noch einen hinzufügen',
      pasteFirst: 'Erst einen Key einfügen',
      baseRequired: 'Base-URL für einen Custom-Provider nötig',
      invalidKey: 'Ungültiger Key',
      footKeys: 'KEYS VERSCHLÜSSELT · JEDERZEIT ÄNDER- ODER WIDERRUFBAR',
      footSkip: 'ÜBERSPRINGEN — SPÄTER ENTSCHEIDEN →',
    },
    tools: {
      back: 'Zurück zu den Providern',
      eyebrow: 'Schritt 04 von 06 — Werkzeuge',
      titleA: 'Gib Goblin die richtigen', titleB: 'Werkzeuge.',
      lead:
        'Zwei Werkzeugkästen, getrennt abgestimmt. Chat & Architektur fürs Denken '
        + '— Websuche, Docs, dein eigenes Repo. Coding & Shipping fürs Machen — Lint, '
        + 'Type-Check, Tests, Deploy. Wähl ein Preset oder kurier von Hand.',
      presetIndieL: 'EMPFOHLEN · AM BELIEBTESTEN', presetIndieName: 'Indie-Builder',
      presetIndieDesc: 'Die 8 Werkzeuge, die 84% der Goblin-Nutzer anlassen. Balance aus Kosten und Können.',
      presetStarterL: 'MIN · FREE-TIER-FREUNDLICH', presetStarterName: 'Starter',
      presetStarterDesc: 'Nur Docs-Lookup + Lint. Keine Web-Aufrufe.',
      presetAllL: 'MAX · POWER-USER', presetAllName: 'Alles an, immer',
      presetAllDesc: 'Jedes Werkzeug unten. Am besten mit Sonnet 4.6 oder GPT-5.',
      chatTitle: 'Chat- & Architektur-Werkzeuge',
      chatSub: 'Goblin greift danach, wenn du spezifizierst, planst oder Fragen stellst.',
      codeTitle: 'Coding- & Shipping-Werkzeuge',
      codeSub: 'Genutzt beim Schreiben, Testen und Pushen von Code.',
      on: 'AN', of: 'VON', recapEnabled: '{n} Werkzeuge aktiv — {preset}-Preset.',
      recapSub: 'Überspring und Goblin behält dieses Preset — Werkzeuge jederzeit in den Einstellungen änderbar.',
      chat: 'CHAT', coding: 'CODING', continueLabel: 'Weiter → Integrationen',
      footChange: 'JEDERZEIT ÄNDERBAR · EINSTELLUNGEN / WERKZEUGE',
      footSkip: 'ÜBERSPRINGEN — STANDARD NUTZEN →',
      beta: 'BETA', soon: 'BALD',
    },
    integ: {
      back: 'Zurück zu den Werkzeugen',
      eyebrow: 'Schritt 05 von 06 — Integrationen',
      titleA: 'Verbinde Goblin mit deinem', titleB: 'Stack.',
      lead:
        'Goblin pusht Code, baut Builds und pingt die richtigen Leute — überall, wo '
        + 'du schon arbeitest. Überspring, was du nicht nutzt; später in den '
        + 'Einstellungen ergänzbar. Jede Zeile hier ist optional.',
      sec1num: '/01 — Jetzt live', sec1title: 'Quelle & Deploy',
      sec1desc: 'Die zwei Integrationen hinter Goblins „Prompt-zu-Live-URL“-Schleife.',
      sec2num: '/02 — Infrastruktur', sec2title: 'Backend & Hosting',
      sec2desc: 'Für Projekte, die einem statischen Deploy entwachsen. Aus den Einstellungen verbindbar, sobald verfügbar.',
      sec3num: '/03 — Geplant', sec3title: 'Zahlungen, Produktivität & Alerts',
      githubDesc: 'Auto-Commit & Push direkt aus dem Chat — die Source-of-Truth für jedes Goblin-Projekt.',
      connectGithub: 'GitHub verbinden', connecting: 'Verbinde…',
      ownTitle: 'Du bringst dein eigenes Vercel mit.',
      ownBody:
        ' Goblin pusht deinen Code in deinen Account, damit das Projekt dir gehört — '
        + 'du kontrollierst Domain, Limits und Rechnung und kannst es später zu jedem '
        + 'Host mitnehmen.',
      ownCta: 'Kostenlosen Vercel-Account erstellen →',
      vercelDesc:
        'Deploys gehen auf DEIN EIGENES Vercel-Konto — deine Domain, deine Kosten. '
        + 'Goblin hostet keine Live-Seiten für dich. Kostenlos für private Projekte.',
      addVercel: 'Vercel-Token hinzufügen',
      vercelTokenLabel: 'Vercel-Token einfügen',
      saveToken: 'Token speichern', saving: 'Speichere…', connected: 'Verbunden',
      recommended: 'EMPFOHLEN', soon: 'BALD',
      mobileTitle: 'Du bist am Desktop.',
      mobileBody: ' Goblin läuft auch auf deinem Handy — arbeite von überall, ship von überall.',
      copyLink: 'Link kopieren', linkCopied: 'Link kopiert ✓',
      summaryEyebrow: 'DU BIST BEREIT · 5 MIN INSGESAMT',
      summaryTitle: 'Provider, Routing, Werkzeuge, Integrationen —',
      summaryBody: 'Goblin hat alles parat. Lass uns dein erstes Projekt bauen.',
      startBuilding: 'Loslegen', skipAll: 'Alles überspringen',
      footAdd: 'INTEGRATIONEN JEDERZEIT · EINSTELLUNGEN / CONNECTORS',
      finish: 'FERTIG →',
    },
  },

  en: {
    chrome: { step: 'STEP', of: 'OF', help: 'HELP' },
    lang: {
      eyebrow: 'Step 00 · Language',
      title: 'Welcome to Goblin',
      hint: 'You can change this any time in Settings.',
      cta: 'Continue',
    },
    step1: {
      eyebrow: 'Set up your workshop',
      titleA: 'How should Goblin',
      titleB: 'talk to AI?',
      lead:
        'You choose how far you go. Most start free with one key and add more '
        + 'later — if ever.',
      bullets: [
        'BYOK — Anthropic, OpenAI, Google, Groq',
        'No card on file. Cancel anytime.',
        'Your keys live in your account, encrypted.',
      ],
      pathBBadge: 'RECOMMENDED',
      pathBNum: 'PATH B', pathBTime: '~ 2 MIN',
      pathBTitle: "I'm new to this.",
      pathBBody:
        "No key yet? We'll walk you through getting a free one — no card, no jargon.",
      pathBTags: ['GUIDED', 'FREE'],
      pathBArr: 'Walk me through it',
      pathANum: 'PATH A', pathATime: '~ 60 SEC',
      pathATitle: 'I already have a key.',
      pathABody:
        "Anthropic, OpenAI, Google, Groq and more — paste it, test it, you're building.",
      pathATag: 'PASTE & GO',
      pathAArr: 'Continue',
      explore: 'Just looking? ', exploreLink: 'Explore first',
      exploreTail: ' — no key needed, soft limits on.',
    },
    layers: {
      back: 'Back',
      eyebrow: 'Step 02 of 06 — How Goblin routes your prompts',
      titleA: 'How Goblin', titleB: 'works.',
      lead:
        'Three layers. You choose how far up you want to go. Most people start at '
        + 'Layer 1 and never leave.',
      items: [
        {
          tag: 'Layer 1', badge: 'ACTIVE',
          title: 'Start free',
          body:
            'Connect a free key (e.g. Groq) — Goblin does the rest. Ready to build '
            + 'in under a minute. This is where most people start and stay.',
        },
        {
          tag: 'Layer 2', badge: 'SOON',
          title: 'Bigger models, no key of your own',
          body:
            "Soon Goblin's own models run straight through — no key, no token panic, "
            + 'no limits. This is exactly what makes Goblin more than a key manager.',
        },
        {
          tag: 'Layer 3', badge: 'OPTIONAL',
          title: 'Premium, your own key',
          body:
            'For your hardest builds: your paid providers. Goblin routes there when '
            + 'you ask — or always, if you set it as the default.',
        },
      ],
      l3cta: 'Add a premium provider',
      waitlistIdle: 'Get on the list', waitlistBusy: 'Adding you…',
      waitlistDone: "You're on the list",
      flow: { prompt: 'Prompt', l1: 'Layer 1 · default', l2: 'Layer 2 · soon', l3: 'Layer 3 · if you opt in' },
      flowCap: 'You can change routing any time in Settings → Routing.',
      continue: 'Continue — pick your provider', skip: 'Skip — use defaults',
      footChange: 'CHANGE ANY TIME · SETTINGS / ROUTING',
      footNext: 'NEXT — PROVIDER →',
    },
    provider: {
      back: '← Back to how Goblin works',
      eyebrow: 'Step 03 of 06 — Pick a provider',
      titleA: 'Pick your AI', titleB: 'provider.',
      lead:
        'Six providers, three patterns: free tier, pay-as-you-go, and fast '
        + 'inference. Start with Groq — Goblin handles the rest.',
      fallbackTitle: 'Pick one. Get all six.',
      fallbackBody:
        'When your provider hits a rate limit or errors, Goblin swaps to the next '
        + 'one in your chain — silently, instantly, no dropped messages.',
      fallbackTag: 'AUTO-FALLBACK · TUNE IN SETTINGS',
      recommended: 'RECOMMENDED · FREE', startSetup: 'Start setup', connect: 'Connect',
      proNoteTitle: 'Claude Pro or ChatGPT Plus?',
      proNoteBody:
        " Your subscription only covers the provider's website — here you need the "
        + "company's API key, which you get separately. Often cheaper than a Pro "
        + 'plan, especially if you only use Goblin now and then.',
      powerBadge: 'POWER USER · ALL FRONTIER MODELS',
      customTitle: 'One key, every model',
      customBody:
        'Fireworks, Together, OpenRouter, Perplexity — or any OpenAI-compatible '
        + 'endpoint. Pay-as-you-go. Get Llama, Mixtral, Qwen, DeepSeek and more with '
        + 'a single key.',
      customPrice: 'FROM ~$0.10 / M TOKENS', addEndpoint: 'Add endpoint',
      whereKey: 'Where do I get this key?',
      baseUrlLabel: 'Base URL', pasteKeyLabel: 'Paste your API key',
      securityNote:
        'Encrypted the moment you paste. Goblin never logs it, never shows it in chat.',
      testConn: 'Test connection', testing: 'Testing…',
      connectedMsg: 'Connected. {p} is ready.',
      continueLabel: 'Continue', addAnother: 'Add another provider',
      savedAddAnother: 'Key saved ✓ — add another',
      pasteFirst: 'Paste a key first',
      baseRequired: 'Base URL required for a custom provider',
      invalidKey: 'Invalid key',
      footKeys: 'KEYS ENCRYPTED · CHANGE OR REVOKE ANY TIME',
      footSkip: 'SKIP — DECIDE LATER →',
    },
    tools: {
      back: 'Back to providers',
      eyebrow: 'Step 04 of 06 — Tools',
      titleA: 'Give Goblin the right', titleB: 'tools.',
      lead:
        'Two toolkits, separately tuned. Chat & architecture for the thinking — web '
        + 'search, docs, your own repo. Coding & shipping for the doing — lint, '
        + 'type-check, tests, deploy. Pick a preset or curate by hand.',
      presetIndieL: 'RECOMMENDED · MOST POPULAR', presetIndieName: 'Indie builder',
      presetIndieDesc: 'The 8 tools 84% of Goblin users keep on. Balanced cost vs. capability.',
      presetStarterL: 'MIN · FREE TIER FRIENDLY', presetStarterName: 'Starter',
      presetStarterDesc: 'Only docs lookup + lint. No web calls.',
      presetAllL: 'MAX · POWER USER', presetAllName: 'All on, all the time',
      presetAllDesc: 'Every tool below. Best on Sonnet 4.6 or GPT-5.',
      chatTitle: 'Chat & architecture tools',
      chatSub: "Goblin reaches for these when you're specifying, planning, or asking questions.",
      codeTitle: 'Coding & shipping tools',
      codeSub: 'Used by Goblin while writing, testing, and pushing code.',
      on: 'ON', of: 'OF', recapEnabled: '{n} tools enabled — {preset} preset.',
      recapSub: 'Skip and Goblin keeps this preset — change tools any time in Settings.',
      chat: 'CHAT', coding: 'CODING', continueLabel: 'Continue → Integrations',
      footChange: 'CHANGE ANY TIME · SETTINGS / TOOLS',
      footSkip: 'SKIP — USE THE DEFAULTS →',
      beta: 'BETA', soon: 'SOON',
    },
    integ: {
      back: 'Back to tools',
      eyebrow: 'Step 05 of 06 — Integrations',
      titleA: 'Plug Goblin into your', titleB: 'stack.',
      lead:
        "Goblin pushes code, runs builds, and pings the right people — everywhere you "
        + "already work. Skip anything you don't use; add it later from Settings. "
        + 'Every line here is optional.',
      sec1num: '/01 — Live now', sec1title: 'Source & deploy',
      sec1desc: 'The two integrations behind Goblin’s "prompt-to-live-URL" loop.',
      sec2num: '/02 — Infrastructure', sec2title: 'Backend & hosting',
      sec2desc: 'For projects that outgrow a static deploy. Connectable from Settings as these land.',
      sec3num: '/03 — Planned', sec3title: 'Payments, productivity & alerts',
      githubDesc: 'Auto-commit & push straight from chat — the source-of-truth for every Goblin project.',
      connectGithub: 'Connect GitHub', connecting: 'Connecting…',
      ownTitle: 'You bring your own Vercel.',
      ownBody:
        ' Goblin pushes your code to your account so the project is yours — you '
        + 'control the domain, the limits, and the bill, and you can take it to any '
        + 'host later.',
      ownCta: 'Create a free Vercel account →',
      vercelDesc:
        "Deploys go to YOUR OWN Vercel account — your domain, your costs. Goblin "
        + "doesn't host live sites for you. Free for personal projects.",
      addVercel: 'Add Vercel token',
      vercelTokenLabel: 'Paste your Vercel token',
      saveToken: 'Save token', saving: 'Saving…', connected: 'Connected',
      recommended: 'RECOMMENDED', soon: 'SOON',
      mobileTitle: "You're on desktop.",
      mobileBody: ' Goblin runs on your phone too — work from anywhere, ship from anywhere.',
      copyLink: 'Copy link', linkCopied: 'Link copied ✓',
      summaryEyebrow: "YOU'RE READY · 5 MIN TOTAL",
      summaryTitle: 'Provider, routing, tools, integrations —',
      summaryBody: "Goblin's got everything queued. Let's build your first project.",
      startBuilding: 'Start building', skipAll: 'Skip all',
      footAdd: 'ADD INTEGRATIONS ANY TIME · SETTINGS / CONNECTORS',
      finish: 'FINISH →',
    },
  },
};

export type { Dict };
