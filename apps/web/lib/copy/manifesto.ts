/**
 * WAVE-ABOUT-MANIFESTO · U2 — the /manifesto copy, as locale keys.
 *
 * BEFORE THIS FILE, /manifesto WAS THE LEAK. `app/manifesto/page.tsx` was a
 * server component with every string hardcoded in English and no locale binding
 * of any kind — not the wrong hook, no hook. It is the same class PR #68 fixed
 * on /about and /help (they were bound to the APP hook, default German, and
 * handed a clean English visitor a German page); /manifesto was never in that
 * sweep because it had nothing to rebind. A German visitor who pressed DE in the
 * switcher got English here and no signal why.
 *
 * The page now reads from these keys through the public/pre-auth binding, so it
 * follows the same precedence as every other public surface (lib/locale.ts).
 *
 * German is deliberately untranslated and marked `@needs-german` — see the full
 * reasoning in lib/copy/about.ts. Short version: this copy's mechanism is its
 * rhythm, a machine translation would destroy it invisibly, and an obvious gap
 * beats a hidden one.
 *
 * Inline `**bold**` / `*italic*` is rendered by lib/copy/rich-text.tsx.
 */

import type { Lang } from '@/lib/locale';

export type Belief = {
  /** The claim itself — the numbered heading. */
  title: string;
  body: string[];
};

export type ManifestoCopy = {
  metaTitle: string;
  metaDescription: string;
  back: string;
  eyebrow: string;
  h1: string;
  /** Exactly six. The count is asserted in the unit test — "Six things we
   *  believe" over five items would be the page lying about itself. */
  beliefs: Belief[];
  soHead: string;
  so: string[];
  /** The closing line, set apart from the `so` paragraphs. */
  soKicker: string;
  ctaLabel: string;
  ctaSubline: string;
};

const en: ManifestoCopy = {
  metaTitle: 'Manifesto — Goblin',
  metaDescription:
    'Six things we believe: honest beats impressive, you own what you build, the phone is a real computer, no meter on your thinking, generating is not shipping, building should not need permission.',
  back: '← Back',
  eyebrow: 'Manifesto',
  h1: 'Six things we believe',
  beliefs: [
    {
      title: 'Honest beats impressive.',
      body: [
        'Every tool you\'ve used has lied to you a little. A green checkmark that only means *the code ran*, not *the thing works*. "Deployed successfully" for a page that returns an error. A progress bar that finished before the work did.',
        "Goblin doesn't do that. When it can't verify something, it says so. When a build fails, it tells you what broke, in your language, without a stack trace. When it doesn't know, it says *I don't know* instead of guessing in a confident font.",
        "That sounds like a small thing. It is the entire thing. **A tool you can't trust isn't a tool — it's a slot machine.**",
      ],
    },
    {
      title: 'You own what you build.',
      body: [
        'Your code goes to your GitHub. Your app goes to your Vercel. Your users go into your database.',
        'Which means the sentence most platforms will never write: **you can leave.** Take the repo, keep the deployment, walk away — and nothing of yours stays behind.',
        "We'd rather earn the next month than lock the door behind you.",
      ],
    },
    {
      title: 'The phone is a real computer.',
      body: [
        'It has more power than the machine that ran the first web server. We just agreed to pretend it\'s for consuming.',
        'Goblin is built phone-first — not shrunk down from a desktop app, but designed for the machine most of the world actually owns. If it works with one thumb on a bus, it works everywhere.',
      ],
    },
    {
      title: 'No meter on your thinking.',
      body: [
        'Nothing kills an idea faster than watching it cost money while you have it.',
        'The AI is included. No keys to fetch, no provider to choose, no counter draining while you decide whether the button should be green. Think as long as you need to.',
      ],
    },
    {
      title: 'Generating is not shipping.',
      body: [
        'Anyone can produce an app that looks right. The race to generate code is over and it has its winners.',
        "We took the exit. Goblin's job starts where the generating stops: does it build, does it deploy, does it *stay up* — and when it breaks at 3am, does anyone notice.",
        "That's not the glamorous half. It's the half that decides whether you have a product or a screenshot.",
      ],
    },
    {
      title: "Building shouldn't need permission.",
      body: [
        "Not from an app store. Not from a laptop budget. Not from three subscriptions and a course you'll never finish.",
        'You have an idea and a screen. That should be the whole list.',
      ],
    },
  ],
  soHead: 'So',
  so: [
    "Somewhere in your notes there's a thing you'd build if the queue were shorter. A tool for your team. A shop for the thing you make. An app your industry has needed for a decade and nobody built, because everyone in it is busy doing the work.",
    "It's still there. Nothing about it got easier while you waited.",
  ],
  soKicker: 'Tell it what you want. It ships.',
  ctaLabel: 'Start building free',
  ctaSubline: '7 days · no credit card',
};

/**
 * @needs-german — every long-form value below is the English text awaiting the
 * founder's German prose. See lib/copy/about.ts for why this is not machine-
 * translated.
 */
const de: ManifestoCopy = {
  metaTitle: en.metaTitle, // @needs-german
  metaDescription: en.metaDescription, // @needs-german
  // Chrome, not prose — translated, because a UI label has no rhythm to lose.
  back: '← Zurück',
  eyebrow: 'Manifest',
  h1: en.h1, // @needs-german
  beliefs: en.beliefs, // @needs-german
  soHead: en.soHead, // @needs-german
  so: en.so, // @needs-german
  soKicker: en.soKicker, // @needs-german
  ctaLabel: en.ctaLabel, // @needs-german
  ctaSubline: en.ctaSubline, // @needs-german
};

export const MANIFESTO_COPY: Record<Lang, ManifestoCopy> = { en, de };
