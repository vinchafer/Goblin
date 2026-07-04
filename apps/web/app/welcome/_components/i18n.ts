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
  // Step 2 — experience fork (do you know "vibe coding"? yes / no)
  experience: {
    eyebrow: string; titleA: string; titleB: string; lead: string;
    yesLabel: string; yesDesc: string; noLabel: string; noDesc: string; cta: string;
  };
  // Conditional (NO branch only) — encouraging vibe-coding explainer
  explainer: {
    eyebrow: string; titleA: string; titleB: string; lead: string;
    points: { title: string; body: string }[];
    close: string; // D2: warm "why this is for you" closing beat
    cta: string;
  };
  // Models + consumption (Goblin Swift vs Goblin Forge, builds budget)
  models: {
    back: string; eyebrow: string; titleA: string; titleB: string; lead: string;
    swiftName: string; swiftBadge: string; swiftDesc: string;
    forgeName: string; forgeBadge: string; forgeDesc: string;
    budgetTitle: string; budgetBody: string; trialNote: string; plansNote: string;
    // D2: frame L2 free + L3 frontier as exciting optional choices
    moreTitle: string; moreFree: string; moreFrontier: string;
    continue: string; footChange: string; footNext: string;
  };
  // First build with Goblin Swift (BYOK optional, secondary)
  build: {
    back: string; eyebrow: string; titleA: string; titleB: string; lead: string;
    primaryCta: string; byokTitle: string; byokBody: string; byokCta: string;
    footNote: string; finish: string;
  };
  // Step 3 — layers / how Goblin works
  layers: {
    back: string; eyebrow: string; titleA: string; titleB: string; lead: string;
    items: { tag: string; badge: string; title: string; body: string }[];
    l2cta: string;
    l3cta: string; waitlistIdle: string; waitlistBusy: string; waitlistDone: string;
    flow: { prompt: string; l1: string; l2: string; l3: string };
    flowCap: string;
    shipNote: string; // D1(a): GitHub + Vercel are built in
    continue: string; skip: string;
    footChange: string; footNext: string;
  };
  // Step 3 — provider
  provider: {
    back: string; eyebrow: string; titleA: string; titleB: string; lead: string;
    fallbackTitle: string; fallbackBody: string; fallbackTag: string;
    freeGroupLabel: string; freeGroupSub: string;
    paidGroupLabel: string; paidGroupSub: string;
    recommended: string; startSetup: string; connect: string;
    proNoteTitle: string; proNoteBody: string;
    powerBadge: string; customTitle: string; customBody: string; customPrice: string;
    addEndpoint: string;
    whereKey: string; baseUrlLabel: string; pasteKeyLabel: string;
    securityNote: string; testConn: string; testing: string;
    connectedMsg: string; continueLabel: string; addAnother: string; savedAddAnother: string;
    save: string; connected: string; customGuide: string[];
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
    githubOwnTitle: string; githubOwnBody: string; githubOwnCta: string;
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
    experience: {
      eyebrow: 'Kurz zu dir',
      titleA: 'Kennst du dich mit',
      titleB: 'Vibe Coding aus?',
      lead:
        'Damit wir dich richtig abholen: Hast du schon mal per KI gebaut, '
        + 'indem du einfach beschreibst, was du willst?',
      yesLabel: 'Ja, kenne ich',
      yesDesc: 'Bring mich direkt rein.',
      noLabel: 'Noch nicht',
      noDesc: 'Zeig mir kurz, wie es funktioniert.',
      cta: 'Weiter',
    },
    explainer: {
      eyebrow: 'Vibe Coding',
      titleA: 'Du sagst, was du willst.',
      titleB: 'Goblin baut es.',
      lead:
        'Du beschreibst in normalen Sätzen, was du willst — Goblin schreibt daraus '
        + 'echten Code, den du mit einem Klick veröffentlichst. Kein Editor-Wissen '
        + 'nötig. So einfach läuft es:',
      points: [
        {
          title: 'Beschreib es in normaler Sprache',
          body:
            'Kein Fachjargon, keine Konfiguration. Sag „Eine Landingpage mit '
            + 'Anmeldeformular“ — das reicht.',
        },
        {
          title: 'Die KI schreibt den Code',
          body:
            'Goblins eingebautes Modell baut echte, lauffähige Dateien — '
            + 'und du siehst jede Zeile.',
        },
        {
          title: 'Du shipst',
          body: 'Ansehen, anpassen, live stellen. Auf jedem Gerät, von überall.',
        },
      ],
      // D2 copy — DRAFT (Gate 3): warm "why this is for you" closing beat.
      close: 'Genau dafür ist Goblin gemacht: Du brauchst keine Erfahrung — nur eine Idee. Lass sie uns bauen.',
      cta: 'Verstanden — weiter',
    },
    models: {
      back: 'Zurück',
      eyebrow: 'Modelle & Verbrauch',
      titleA: 'Zwei Modelle.', titleB: 'Ein Budget.',
      lead:
        'Beide sind eingebaut — kein Key nötig. Du wählst pro Build, wie viel '
        + 'Power du brauchst.',
      swiftName: 'Goblin Swift', swiftBadge: 'STANDARD',
      swiftDesc:
        'Schnell und effizient — dein Alltags-Default. Ideal für direkte '
        + 'Coding-Aufgaben und schnelle Iterationen. Ein Swift-Build zählt als '
        + 'ein Build deines Monatsbudgets.',
      forgeName: 'Goblin Forge', forgeBadge: 'MEHR POWER',
      forgeDesc:
        'Stärkeres Reasoning — für Architektur und komplexe, härtere Builds. '
        + 'Nimm ihn, wenn Swift nicht reicht. Zieht mehr aus deinem Monatsbudget.',
      budgetTitle: 'Dein Monatsbudget',
      budgetBody:
        'Kein Token-Zähler, keine Überraschungen: ein Budget pro Monat. '
        + 'Swift-Builds zählen einfach, Forge-Builds ziehen mehr.',
      trialNote: 'In deiner Testphase: {trial} gratis, keine Karte.',
      plansNote: 'Bezahlte Pläne: {build}, {pro}, {power}.',
      // D2 copy — DRAFT (Gate 3): free + frontier as exciting optional choices.
      moreTitle: 'Willst du mehr?',
      moreFree: 'Kostenlos: schalte stärkere Drittanbieter-Modelle frei (Groq, Gemini) — keine Karte.',
      moreFrontier: 'Frontier: bring deinen eigenen Key für Spitzenqualität, wann du willst — dein Key, kein Aufschlag.',
      continue: 'Weiter — Loslegen',
      footChange: 'MODELL JEDERZEIT PRO BUILD WÄHLBAR',
      footNext: 'WEITER — ERSTER BUILD →',
    },
    build: {
      back: 'Zurück',
      eyebrow: 'Erster Build',
      titleA: 'Bereit?', titleB: 'Bau dein erstes Projekt.',
      lead:
        'Goblin Swift ist startklar — kein Key, keine Karte. Beschreib, was du '
        + 'willst, und Goblin baut es.',
      primaryCta: 'Ersten Build starten',
      byokTitle: 'Mehr Modelle entdecken?',
      byokBody:
        'Optional, jederzeit später. Verbinde kostenlose Modelle (Groq, Gemini) '
        + 'oder deine eigenen bezahlten Provider — nötig ist es nie.',
      byokCta: 'Modelle ansehen (optional)',
      footNote: 'START MIT GOBLIN SWIFT · KEYS JEDERZEIT IN DEN EINSTELLUNGEN',
      finish: 'LOSLEGEN →',
    },
    layers: {
      back: 'Zurück',
      eyebrow: 'Wie Goblin arbeitet',
      titleA: 'Wie Goblin', titleB: 'arbeitet.',
      lead:
        'Drei Ebenen. Die erste ist der Standard und läuft sofort — die '
        + 'anderen zwei sind optional, wenn du mehr willst.',
      items: [
        {
          tag: 'Ebene 1', badge: 'STANDARD',
          title: 'Goblins eigene Modelle — kein Key',
          body:
            'Goblin Swift und Goblin Forge sind eingebaut und laufen in der Cloud. '
            + 'Kein Schlüssel, kein Setup, kein Laptop nötig — das ist der Standard '
            + 'und funktioniert sofort.',
        },
        {
          tag: 'Ebene 2', badge: 'OPTIONAL',
          title: 'Kostenlose Drittanbieter-Modelle',
          body:
            'Du kannst zusätzlich einen kostenlosen Key eines Anbieters (z.B. Groq '
            + 'oder Gemini) verbinden — gratis Kontingent, keine Karte. Rein optional.',
        },
        {
          tag: 'Ebene 3', badge: 'OPTIONAL',
          title: 'Eigene Keys (BYOK)',
          body:
            'Für die härtesten Builds bringst du deine eigenen bezahlten Provider '
            + 'mit — bis zu 2 Keys pro Provider, beliebig viele Provider. Jederzeit, '
            + 'komplett optional.',
        },
      ],
      l2cta: 'Kostenlose Modelle ansehen',
      l3cta: 'Eigenen Key hinzufügen',
      waitlistIdle: 'Mehr erfahren', waitlistBusy: '…',
      waitlistDone: 'Alles klar',
      flow: { prompt: 'Prompt', l1: 'Ebene 1 · Standard', l2: 'Ebene 2 · optional', l3: 'Ebene 3 · optional' },
      flowCap: 'Der Standard funktioniert sofort — kein Key, keine Konfiguration.',
      // D1(a) copy — DRAFT (Gate 3): GitHub + Vercel are built in.
      shipNote: 'Und wenn du live gehen willst: GitHub und Vercel sind eingebaut — ein Klick vom Chat zum gespeicherten Stand zur Live-Vorschau.',
      continue: 'Weiter — Modelle ansehen', skip: 'Überspringen',
      footChange: 'STANDARD FUNKTIONIERT SOFORT — KEIN KEY',
      footNext: 'WEITER — MODELLE →',
    },
    provider: {
      back: 'Zurück',
      eyebrow: 'Eigene Keys (optional)',
      titleA: 'Wähl deinen KI-', titleB: 'Provider.',
      lead:
        'BYOK ist optional — Goblin Swift läuft schon ohne Key. Wenn du willst: '
        + 'verbinde einen kostenlosen Key (z.B. Groq) oder deine bezahlten Provider. '
        + 'Bis zu 2 Keys pro Provider, beliebig viele Provider.',
      fallbackTitle: 'Mehrere verbinden. Abgesichert bleiben.',
      fallbackBody:
        'Wenn einer deiner Provider unzuverlässig wird, leitet Goblin neue Anfragen '
        + 'automatisch an einen anderen verbundenen Provider weiter — du baust einfach weiter.',
      fallbackTag: 'AUTO-ROUTING · ÜBER DEINE PROVIDER',
      // 1D value copy — DRAFT (Gate 3): both tiers framed as exciting choices, not homework.
      freeGroupLabel: 'Kostenlos · keine Karte',
      freeGroupSub: 'Schalte kostenlos stärkere Modelle frei — weiterhin keine Karte, du brauchst nur ein Google-Konto.',
      paidGroupLabel: 'Bezahlt · Frontier · nutzungsbasiert',
      paidGroupSub: 'Bring deinen eigenen Key für Spitzenqualität, wann du willst — dein Key, kein Aufschlag, du zahlst nur, was du nutzt.',
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
      savedAddAnother: 'Key gespeichert ✓ — noch einen hinzufügen oder weiter',
      save: 'Key speichern', connected: 'GESPEICHERT',
      customGuide: [
        'Die Base-URL des Providers — z.B. https://api.together.xyz/v1',
        'Ein API-Schlüssel aus dem Dashboard dieses Providers',
        'Beides unten einfügen — Goblin routet über seinen OpenAI-kompatiblen Adapter',
      ],
      pasteFirst: 'Erst einen Key einfügen',
      baseRequired: 'Base-URL für einen Custom-Provider nötig',
      invalidKey: 'Ungültiger Key',
      footKeys: 'KEYS VERSCHLÜSSELT · JEDERZEIT ÄNDER- ODER WIDERRUFBAR',
      footSkip: 'ÜBERSPRINGEN — SPÄTER ENTSCHEIDEN →',
    },
    tools: {
      back: 'Zurück',
      eyebrow: 'Werkzeuge',
      titleA: 'Gib Goblin die richtigen', titleB: 'Werkzeuge.',
      lead:
        'Zwei Werkzeugkästen, getrennt abgestimmt. Chat & Architektur fürs Denken '
        + '— Websuche, Docs, dein eigenes Repo. Coding & Shipping fürs Machen — Lint, '
        + 'Type-Check, Tests, Deploy. Wähl ein Preset oder kurier von Hand.',
      presetIndieL: 'EMPFOHLEN · AUSGEWOGEN', presetIndieName: 'Indie-Builder',
      presetIndieDesc: 'Eine ausgewogene Auswahl fürs schnelle Bauen — Balance aus Kosten und Können.',
      presetStarterL: 'MIN · FREE-TIER-FREUNDLICH', presetStarterName: 'Starter',
      presetStarterDesc: 'Nur Docs-Lookup + Lint. Keine Web-Aufrufe.',
      presetAllL: 'MAX · POWER-USER', presetAllName: 'Alles an, immer',
      presetAllDesc: 'Jedes Werkzeug unten. Am besten mit den stärksten Modellen (Claude, GPT).',
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
      back: 'Zurück',
      eyebrow: 'Integrationen',
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
      githubDesc: 'Automatisch gesichert & veröffentlicht direkt aus dem Chat — die verlässliche Quelle für jedes Goblin-Projekt.',
      connectGithub: 'GitHub verbinden', connecting: 'Verbinde…',
      githubOwnTitle: 'Noch kein GitHub?',
      githubOwnBody:
        ' Goblin pusht in dein eigenes GitHub — du behältst den Code. '
        + 'Der Account ist kostenlos.',
      githubOwnCta: 'Kostenloses GitHub erstellen →',
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
      summaryEyebrow: 'DU BIST BEREIT',
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
    experience: {
      eyebrow: 'Quick question',
      titleA: 'Are you familiar with',
      titleB: 'vibe coding?',
      lead:
        "So we pitch this at the right level: have you built with AI before, "
        + 'just by describing what you want?',
      yesLabel: "Yes, I am",
      yesDesc: 'Take me straight in.',
      noLabel: 'Not yet',
      noDesc: 'Show me how it works first.',
      cta: 'Continue',
    },
    explainer: {
      eyebrow: 'Vibe coding',
      titleA: 'You say what you want.',
      titleB: 'Goblin builds it.',
      lead:
        'You describe what you want in plain sentences — Goblin turns it into real '
        + 'code that you publish with one click. No editor skills needed. Here is how '
        + 'it works:',
      points: [
        {
          title: 'Describe it in plain language',
          body:
            'No jargon, no configuration. Say "a landing page with a signup form" — '
            + "that's enough.",
        },
        {
          title: 'The AI writes the code',
          body:
            "Goblin's built-in model produces real, runnable files — and you see "
            + 'every line.',
        },
        {
          title: 'You ship',
          body: 'Preview, tweak, go live. On any device, from anywhere.',
        },
      ],
      // D2 copy — DRAFT (Gate 3): warm "why this is for you" closing beat.
      close: 'That’s exactly what Goblin is for: you need no experience — just an idea. Let’s build it.',
      cta: 'Got it — continue',
    },
    models: {
      back: 'Back',
      eyebrow: 'Models & consumption',
      titleA: 'Two models.', titleB: 'One budget.',
      lead:
        'Both are built in — no key needed. You choose per build how much power '
        + 'you want.',
      swiftName: 'Goblin Swift', swiftBadge: 'DEFAULT',
      swiftDesc:
        'Fast and efficient — your everyday default. Great for straightforward '
        + 'coding tasks and quick iterations. One Swift build counts as one '
        + 'build of your monthly budget.',
      forgeName: 'Goblin Forge', forgeBadge: 'MORE POWER',
      forgeDesc:
        'Stronger reasoning — for architecture and complex, harder builds. Reach '
        + "for it when Swift isn't enough. Draws more from your monthly budget.",
      budgetTitle: 'Your monthly budget',
      budgetBody:
        'No token counter, no surprises: one budget per month. Swift builds count '
        + 'simply, Forge builds draw more.',
      trialNote: 'On your trial: {trial} free, no card.',
      plansNote: 'Paid plans: {build}, {pro}, {power}.',
      // D2 copy — DRAFT (Gate 3): free + frontier as exciting optional choices.
      moreTitle: 'Want more?',
      moreFree: 'Free: unlock more capable third-party models (Groq, Gemini) — no card.',
      moreFrontier: 'Frontier: bring your own key for top-tier quality when you want it — your key, no markup.',
      continue: 'Continue — let’s build',
      footChange: 'PICK THE MODEL PER BUILD, ANY TIME',
      footNext: 'NEXT — FIRST BUILD →',
    },
    build: {
      back: 'Back',
      eyebrow: 'First build',
      titleA: 'Ready?', titleB: 'Build your first project.',
      lead:
        'Goblin Swift is ready to go — no key, no card. Describe what you want and '
        + 'Goblin builds it.',
      primaryCta: 'Start your first build',
      byokTitle: 'Explore more models?',
      byokBody:
        'Optional, any time later. Connect free models (Groq, Gemini) or your own '
        + 'paid providers — you never have to.',
      byokCta: 'Explore models (optional)',
      footNote: 'START WITH GOBLIN SWIFT · ADD KEYS ANY TIME IN SETTINGS',
      finish: "LET'S GO →",
    },
    layers: {
      back: 'Back',
      eyebrow: 'How Goblin works',
      titleA: 'How Goblin', titleB: 'works.',
      lead:
        'Three layers. The first is the default and works right now — the '
        + 'other two are optional, for when you want more.',
      items: [
        {
          tag: 'Layer 1', badge: 'DEFAULT',
          title: "Goblin's own models — no key",
          body:
            'Goblin Swift and Goblin Forge are built in and run in the cloud. No '
            + 'key, no setup, no laptop needed — this is the default and it works '
            + 'right now.',
        },
        {
          tag: 'Layer 2', badge: 'OPTIONAL',
          title: 'Free third-party models',
          body:
            'You can also connect a free provider key (e.g. Groq or Gemini) — free '
            + 'tier, no card. Entirely optional.',
        },
        {
          tag: 'Layer 3', badge: 'OPTIONAL',
          title: 'Bring your own keys (BYOK)',
          body:
            'For your hardest builds, bring your own paid providers — up to 2 keys '
            + 'per provider, unlimited providers. Any time, fully optional.',
        },
      ],
      l2cta: 'See the free models',
      l3cta: 'Add your own key',
      waitlistIdle: 'Learn more', waitlistBusy: '…',
      waitlistDone: 'Got it',
      flow: { prompt: 'Prompt', l1: 'Layer 1 · default', l2: 'Layer 2 · optional', l3: 'Layer 3 · optional' },
      flowCap: 'The default works out of the box — no key, no setup.',
      // D1(a) copy — DRAFT (Gate 3): GitHub + Vercel are built in.
      shipNote: 'And when you want to go live: GitHub and Vercel are built in — one click from chat to a saved version to live preview.',
      continue: 'Continue — see the models', skip: 'Skip',
      footChange: 'THE DEFAULT WORKS OUT OF THE BOX — NO KEY',
      footNext: 'NEXT — MODELS →',
    },
    provider: {
      back: 'Back',
      eyebrow: 'Bring your own keys (optional)',
      titleA: 'Pick your AI', titleB: 'provider.',
      lead:
        'BYOK is optional — Goblin Swift already runs with no key. If you want: '
        + 'connect a free key (e.g. Groq) or your paid providers. Up to 2 keys per '
        + 'provider, unlimited providers.',
      fallbackTitle: 'Connect a few. Stay covered.',
      fallbackBody:
        'If one of your providers becomes unreliable, Goblin automatically routes new '
        + "requests to another provider you've connected — so you keep building.",
      fallbackTag: 'AUTO-ROUTING · ACROSS YOUR PROVIDERS',
      // 1D value copy — DRAFT (Gate 3): both tiers framed as exciting choices, not homework.
      freeGroupLabel: 'Free · no card',
      freeGroupSub: 'Add more capable models for free — still no card, all you need is a Google account.',
      paidGroupLabel: 'Paid · frontier · usage-based',
      paidGroupSub: 'Bring your own key for top-tier quality when you want it — your key, no markup, pay only for what you use.',
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
      savedAddAnother: 'Key saved ✓ — add another or continue',
      save: 'Save key', connected: 'SAVED',
      customGuide: [
        "The provider's base URL — e.g. https://api.together.xyz/v1",
        "An API key from that provider's dashboard",
        'Paste both below — Goblin routes through its OpenAI-compatible adapter',
      ],
      pasteFirst: 'Paste a key first',
      baseRequired: 'Base URL required for a custom provider',
      invalidKey: 'Invalid key',
      footKeys: 'KEYS ENCRYPTED · CHANGE OR REVOKE ANY TIME',
      footSkip: 'SKIP — DECIDE LATER →',
    },
    tools: {
      back: 'Back',
      eyebrow: 'Tools',
      titleA: 'Give Goblin the right', titleB: 'tools.',
      lead:
        'Two toolkits, separately tuned. Chat & architecture for the thinking — web '
        + 'search, docs, your own repo. Coding & shipping for the doing — lint, '
        + 'type-check, tests, deploy. Pick a preset or curate by hand.',
      presetIndieL: 'RECOMMENDED · BALANCED', presetIndieName: 'Indie builder',
      presetIndieDesc: 'A balanced set for fast building — balanced cost vs. capability.',
      presetStarterL: 'MIN · FREE TIER FRIENDLY', presetStarterName: 'Starter',
      presetStarterDesc: 'Only docs lookup + lint. No web calls.',
      presetAllL: 'MAX · POWER USER', presetAllName: 'All on, all the time',
      presetAllDesc: 'Every tool below. Best on the strongest models (Claude, GPT).',
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
      back: 'Back',
      eyebrow: 'Integrations',
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
      githubDesc: 'Automatically saved & published straight from chat — the reliable source for every Goblin project.',
      connectGithub: 'Connect GitHub', connecting: 'Connecting…',
      githubOwnTitle: 'No GitHub yet?',
      githubOwnBody:
        " Goblin pushes to your own GitHub — you keep the code. "
        + 'The account is free.',
      githubOwnCta: 'Create a free GitHub →',
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
      summaryEyebrow: "YOU'RE READY",
      summaryTitle: 'Provider, routing, tools, integrations —',
      summaryBody: "Goblin's got everything queued. Let's build your first project.",
      startBuilding: 'Start building', skipAll: 'Skip all',
      footAdd: 'ADD INTEGRATIONS ANY TIME · SETTINGS / CONNECTORS',
      finish: 'FINISH →',
    },
  },
};

export type { Dict };

// ── Provider catalog copy (Step 3) ────────────────────────────────────────
// Language-dependent, version-free copy keyed by provider id. Header subs use
// an UN-versioned family name + capability tier only (A.4): "Llama", "Gemini",
// "GPT", "Claude" — NEVER "3.3 70B" / "2.5 Pro" / "GPT-5". The live dynamic
// catalog in-app shows the actual model names.
export type ProvCopyId = 'groq' | 'google' | 'openai' | 'anthropic' | 'deepseek' | 'mistral';

export interface ProvCopy {
  sub: string;
  pillLabel: string;
  copy?: string;
  pros: string[];
  price: string;
  guide: string[];
}

export const PROV_COPY: Record<Lang, Record<ProvCopyId, ProvCopy>> = {
  de: {
    groq: {
      sub: 'Llama · kostenlos, schnell', pillLabel: 'KOSTENLOS · SCHNELL',
      copy:
        'Der einfachste Start: schnell, kostenlos und sofort einsatzbereit. Läuft '
        + 'heute schon zuverlässig in Goblin — perfekt für deinen ersten Build.',
      pros: [
        'Kostenlos, schnell, großzügiges Tageslimit',
        '3–5× schneller als die Standard-API',
        'Läuft über Goblins verschlüsselten Proxy',
      ],
      price: 'KOSTENLOS · KEINE KARTE',
      guide: [
        'Geh auf console.groq.com/keys',
        'Mit Google/GitHub anmelden',
        'Auf „Create API Key“ klicken',
        'Schlüssel kopieren, unten einfügen',
      ],
    },
    google: {
      sub: 'Gemini · Free Tier', pillLabel: 'KOSTENLOS',
      pros: [
        'Großzügiges kostenloses Kontingent — keine Karte',
        'Starkes Coding, Bild + Audio, riesiger Kontext',
        'Auto-Routing über Goblins verschlüsselten Proxy',
      ],
      price: 'KOSTENLOS · KEINE KARTE',
      guide: [
        'Geh auf aistudio.google.com',
        'Mit Google-Account anmelden',
        'Auf „Get API key“ → „Create“ klicken',
        'Schlüssel kopieren, unten einfügen',
      ],
    },
    openai: {
      sub: 'GPT · nutzungsbasiert', pillLabel: 'NUTZUNG',
      pros: ['Frontier-Reasoning, tiefste Modell-Bench', 'Pay-as-you-go, kein Abo', 'Bild, Audio, strukturierte Outputs'],
      price: 'AB ~$0,01 / CHAT',
      guide: [
        'Geh auf platform.openai.com/api-keys',
        'Anmelden, „Create new secret key“ klicken',
        'Schlüssel kopieren (nur einmal sichtbar)',
        'Unten einfügen',
      ],
    },
    anthropic: {
      sub: 'Claude · Premium', pillLabel: 'NUTZUNG',
      pros: ['Spitzenklasse-Code-Generierung', 'Riesiger Kontext, lange Edits', 'Beste Qualität für komplexe Builds'],
      price: 'AB ~$0,02 / CHAT',
      guide: [
        'Geh auf console.anthropic.com',
        'Anmelden, „API Keys“ öffnen',
        'Auf „Create key“ klicken',
        'Kopieren, unten einfügen',
      ],
    },
    deepseek: {
      sub: 'DeepSeek · nutzungsbasiert', pillLabel: 'NUTZUNG',
      pros: ['Günstigster Frontier-Coder', 'Spezialisierter Coder für Code-Generierung'],
      price: 'AB ~$0,003 / CHAT',
      guide: ['Geh auf platform.deepseek.com', 'Anmelden, „API keys“ öffnen', 'Erstellen + kopieren', 'Unten einfügen'],
    },
    mistral: {
      sub: 'Mistral · EU-gehostet', pillLabel: 'NUTZUNG',
      pros: ['EU-gehostet, DSGVO-bereit — für Teams mit Datenresidenz', 'Spezialisiertes Code-Completion-Modell'],
      price: 'AB ~$0,008 / CHAT',
      guide: ['Geh auf console.mistral.ai', 'Anmelden, „API Keys“ öffnen', 'Erstellen + kopieren', 'Unten einfügen'],
    },
  },
  en: {
    groq: {
      sub: 'Llama · free, fast', pillLabel: 'FREE · FAST',
      copy:
        'The easiest start: fast, free, and ready right away. Already runs reliably '
        + 'in Goblin today — perfect for your first build.',
      pros: [
        'Free, fast, generous daily limit',
        '3–5× faster than the standard API',
        "Runs through Goblin's encrypted proxy",
      ],
      price: 'FREE · NO CARD',
      guide: [
        'Go to console.groq.com/keys',
        'Sign in with Google/GitHub',
        'Click "Create API Key"',
        'Copy the key, paste it below',
      ],
    },
    google: {
      sub: 'Gemini · Free Tier', pillLabel: 'FREE',
      pros: [
        'Generous free tier — no card',
        'Strong coding, image + audio, huge context',
        "Auto-routes through Goblin's encrypted proxy",
      ],
      price: 'FREE · NO CARD',
      guide: [
        'Go to aistudio.google.com',
        'Sign in with your Google account',
        'Click "Get API key" → "Create"',
        'Copy the key, paste it below',
      ],
    },
    openai: {
      sub: 'GPT · pay-as-you-go', pillLabel: 'USAGE',
      pros: ['Frontier reasoning, deepest model bench', 'Pay-as-you-go, no subscription', 'Image, audio, structured outputs'],
      price: 'FROM ~$0.01 / CHAT',
      guide: [
        'Go to platform.openai.com/api-keys',
        'Sign in, click "Create new secret key"',
        'Copy the key (shown only once)',
        'Paste below',
      ],
    },
    anthropic: {
      sub: 'Claude · Premium', pillLabel: 'USAGE',
      pros: ['Best-in-class code generation', 'Huge context, long-running edits', 'Best quality for complex builds'],
      price: 'FROM ~$0.02 / CHAT',
      guide: [
        'Go to console.anthropic.com',
        'Sign in, open "API Keys"',
        'Click "Create key"',
        'Copy, paste below',
      ],
    },
    deepseek: {
      sub: 'DeepSeek · pay-as-you-go', pillLabel: 'USAGE',
      pros: ['Cheapest frontier-class coder', 'Specialised coder for code generation'],
      price: 'FROM ~$0.003 / CHAT',
      guide: ['Go to platform.deepseek.com', 'Sign in, open "API keys"', 'Create + copy', 'Paste below'],
    },
    mistral: {
      sub: 'Mistral · EU-hosted', pillLabel: 'USAGE',
      pros: ['EU-hosted, GDPR-ready — for teams that need data residency', 'Specialised code-completion model'],
      price: 'FROM ~$0.008 / CHAT',
      guide: ['Go to console.mistral.ai', 'Sign in, open "API Keys"', 'Create + copy', 'Paste below'],
    },
  },
};

// ── Tool catalog copy (Step 4) ─────────────────────────────────────────────
export type ToolCopyId =
  | 'web_search' | 'docs_lookup' | 'repo_search' | 'screenshot'
  | 'design_refs' | 'schema_gen'
  | 'lint_format' | 'type_check' | 'test_runner' | 'deploy'
  | 'pr_opener' | 'db_migrations';

export const TOOL_COPY: Record<Lang, Record<ToolCopyId, { name: string; desc: string }>> = {
  de: {
    web_search: { name: 'Websuche', desc: 'Belegte Live-Websuche mit Quellen.' },
    docs_lookup: { name: 'Doku-Lookup', desc: 'Live MDN, npm & offizielle Docs nachschlagen.' },
    repo_search: { name: 'Repo-Suche', desc: 'Durchsucht deine verknüpften GitHub-Repos.' },
    screenshot: { name: 'Screenshot-Verständnis', desc: 'Wirf einen Screenshot rein — braucht ein Vision-Modell (z.B. Gemini).' },
    design_refs: { name: 'Design-Referenzen', desc: 'Stöbert in Dribbble & Behance.' },
    schema_gen: { name: 'Schema-Generator', desc: 'Klartext → SQL / Prisma / Zod.' },
    lint_format: { name: 'Lint & Format', desc: 'Prettier · ESLint, vor dem Diff auto-gefixt.' },
    type_check: { name: 'Type-Check', desc: 'tsc · pyright bei jeder Änderung.' },
    test_runner: { name: 'Test-Runner', desc: 'Vitest · Jest · Playwright.' },
    deploy: { name: 'Deploy', desc: 'Ein-Klick-Deploy zu Vercel.' },
    pr_opener: { name: 'PR-Öffner', desc: 'Öffnet einen Draft-PR statt direkt zu pushen.' },
    db_migrations: { name: 'Datenbank-Migrationen', desc: 'Generiert & führt Prisma- / Drizzle-Migrationen aus.' },
  },
  en: {
    web_search: { name: 'Web search', desc: 'Cited, live web search.' },
    docs_lookup: { name: 'Documentation lookup', desc: 'Live MDN, npm & official-docs lookup.' },
    repo_search: { name: 'Repo search', desc: 'Searches your linked GitHub repos.' },
    screenshot: { name: 'Screenshot understanding', desc: 'Drop a screenshot — works on a vision model (e.g. Gemini).' },
    design_refs: { name: 'Design references', desc: 'Browses Dribbble & Behance.' },
    schema_gen: { name: 'Schema generator', desc: 'Plain-English → SQL / Prisma / Zod.' },
    lint_format: { name: 'Lint & format', desc: 'Prettier · ESLint, auto-fixed before diff.' },
    type_check: { name: 'Type check', desc: 'tsc · pyright on every change.' },
    test_runner: { name: 'Test runner', desc: 'Vitest · Jest · Playwright.' },
    deploy: { name: 'Deploy', desc: 'One-click deploy to Vercel.' },
    pr_opener: { name: 'PR opener', desc: 'Opens a draft PR instead of pushing direct.' },
    db_migrations: { name: 'Database migrations', desc: 'Generates & runs Prisma / Drizzle migrations.' },
  },
};
