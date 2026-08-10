/**
 * WAVE-ABOUT-MANIFESTO · U2 — the /about copy, as locale keys.
 *
 * Every user-facing string on the page lives here. The page component contains
 * no prose at all, which is the rule PR #68 was opened for: a string that never
 * reaches the key system is a string that cannot be translated, and the /about
 * page has already shipped once in the wrong language because of exactly that.
 *
 * ── GERMAN IS DELIBERATELY NOT TRANSLATED YET ───────────────────────────────
 * Every `de` value below is the ENGLISH text, marked `@needs-german`. That is a
 * conscious choice, not an oversight, and it is the honest one:
 *
 *   This copy's mechanism is its rhythm — long, long, short; the short sentence
 *   is the one that lands. A machine translation preserves the meaning and
 *   destroys the mechanism, and it would do so invisibly: nobody reviewing the
 *   diff in English can see that the German has gone flat. Shipping English
 *   under a `de` key is a visible, self-announcing gap. Shipping bad German
 *   would be an invisible one.
 *
 * So a German visitor currently reads this page in English and can see that it
 * is English. The founder supplies the real German prose; the only change needed
 * then is the `de` block below and deleting its `@needs-german` markers.
 *
 * Inline `**bold**` / `*italic*` is rendered by lib/copy/rich-text.tsx — see that
 * file for why emphasis is inline rather than split across keys.
 */

import type { Lang } from '@/lib/locale';

export type AboutCopy = {
  /** <title> and meta description — SEO, not on-page. */
  metaTitle: string;
  metaDescription: string;
  /** Back-link to the landing. */
  back: string;
  /** Small mono label above the H1, matching the landing's section eyebrows. */
  eyebrow: string;
  h1: string;
  /** The opening beat. No heading — it runs straight on from the H1. */
  intro: string[];
  gapHead: string;
  gap: string[];
  whatHead: string;
  what: string[];
  /** The marked spot: the link to /manifesto, immediately after `what`. */
  manifestoLink: string;
  whoHead: string;
  who: string[];
};

const en: AboutCopy = {
  metaTitle: 'About — Goblin',
  metaDescription:
    "Goblin started in a hotel room in Argentina, on a phone. It lives in the gap between a generated app and a shipped one — the gap where almost everything dies.",
  back: '← Back',
  eyebrow: 'About',
  h1: 'I started this in a hotel room in Argentina.',
  intro: [
    'Not as a stunt. Because that was the machine I had with me.',
    "Nine time zones from my desk, no laptop, an idea that wouldn't leave me alone — and a phone.",
    "Between those two things sat an industry telling me: get a machine, install a runtime, pick a framework, buy three subscriptions, learn a terminal. Then we'll talk.",
    "That's not a technical requirement. It's a queue. And someone decided who gets to stand in it.",
  ],
  gapHead: 'The thing nobody says out loud',
  gap: [
    'AI can write code now. That part is finished. Anyone can generate an app.',
    "What almost nobody can do is **ship** one. Because shipping isn't generating. Shipping is a build that actually compiles, a deploy that actually serves, a database that actually keeps your users apart, a link you can send to your mother and she opens it and it works.",
    "That gap — between *generated* and *shipped* — is where almost everything dies. It's where the demo ends and the tutorial starts. It's why a thousand people have a folder of half-apps and nothing live.",
    "Goblin lives in that gap. That's the whole product.",
  ],
  whatHead: 'What it is',
  what: [
    'You describe what you want. The agent builds it, verifies it, and ships it — and you watch every step and take the wheel whenever you like.',
    'No keys. No setup. No token counter ticking in the corner while you think.',
    "It runs in the cloud, so the machine in your pocket is enough. Your code goes to your GitHub. Your app deploys to your Vercel. Your users' data sits in your database.",
    "Not ours. Yours — and that's not a feature, it's the deal.",
  ],
  manifestoLink: 'Read the Manifesto',
  whoHead: "Who's behind it",
  who: [
    'One person. A solo founder from Switzerland.',
    'No team yet, no investors yet, no roadmap slide with four quarters on it. Just a builder who got tired of the queue and wrote the way out — mostly from a phone, which turned out to be the honest test of whether any of this really works.',
    "You're early. Early means you'll find things I haven't. When you do, tell me — I'm the one who reads it.",
  ],
};

/**
 * @needs-german — every value below is the English text awaiting the founder's
 * German prose. See the file header for why this is not machine-translated.
 */
const de: AboutCopy = {
  metaTitle: en.metaTitle, // @needs-german
  metaDescription: en.metaDescription, // @needs-german
  // FOLLOW-UP (founder decision 2026-08-10): the chrome was translated here
  // ("← Zurück", "Über uns") while the prose stayed English. On screen that read
  // as a half-finished translation rather than as a declared gap, so the whole
  // page is English until the German prose exists — chrome included. The keys
  // still exist and are still marked; only their values wait.
  // See lib/copy/prose-locale.ts for the switch that pins the selection.
  back: en.back, // @needs-german
  eyebrow: en.eyebrow, // @needs-german
  h1: en.h1, // @needs-german
  intro: en.intro, // @needs-german
  gapHead: en.gapHead, // @needs-german
  gap: en.gap, // @needs-german
  whatHead: en.whatHead, // @needs-german
  what: en.what, // @needs-german
  manifestoLink: en.manifestoLink, // @needs-german
  whoHead: en.whoHead, // @needs-german
  who: en.who, // @needs-german
};

export const ABOUT_COPY: Record<Lang, AboutCopy> = { en, de };
