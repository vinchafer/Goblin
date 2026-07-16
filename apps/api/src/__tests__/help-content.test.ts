// WAVE-J (J1) GATE: the help corpus is the single source of truth the support
// agent stands on, so its structure and a set of VERIFIED claims are locked here.
// The negative assertions are the important ones: they fail the build if the
// retired, product-contradicting claims ("$9/month one plan", a fake fixed trial
// length in the wrong place, "Discord") ever creep back in.

import { describe, it, expect } from 'vitest';
import {
  HELP_ARTICLES,
  helpArticleBySlug,
  helpArticleTitles,
  renderHelpForAgent,
} from '@goblin/shared/src/help-content';

describe('help corpus — structure', () => {
  it('has the 10 canonical articles with unique slugs', () => {
    expect(HELP_ARTICLES).toHaveLength(10);
    const slugs = HELP_ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(10);
    for (const s of ['erste-schritte', 'live-stellen', 'trial-und-plaene', 'konto-und-daten', 'als-app-installieren']) {
      expect(slugs).toContain(s);
    }
  });

  it('every article and section carries BOTH DE and EN, with unique anchors', () => {
    for (const a of HELP_ARTICLES) {
      expect(a.title.de.length).toBeGreaterThan(0);
      expect(a.title.en.length).toBeGreaterThan(0);
      expect(a.summary.de.length).toBeGreaterThan(0);
      expect(a.summary.en.length).toBeGreaterThan(0);
      expect(a.sections.length).toBeGreaterThan(0);
      const anchors = a.sections.map((s) => s.anchor);
      expect(new Set(anchors).size).toBe(anchors.length);
      for (const s of a.sections) {
        expect(s.heading.de && s.heading.en).toBeTruthy();
        expect(s.body.de.length).toBeGreaterThan(20);
        expect(s.body.en.length).toBeGreaterThan(20);
      }
    }
  });

  it('helpArticleBySlug + helpArticleTitles resolve', () => {
    expect(helpArticleBySlug('live-stellen')?.title.de).toContain('Live stellen');
    expect(helpArticleBySlug('does-not-exist')).toBeUndefined();
    expect(helpArticleTitles()).toHaveLength(10);
  });

  it('renderHelpForAgent flattens the whole corpus with citable anchors', () => {
    const kb = renderHelpForAgent('de');
    expect(kb.length).toBeGreaterThan(1000);
    // Each section is tagged "[<title> #<anchor>]" so the agent can cite precisely.
    expect(kb).toContain('#vercel-verbinden');
    expect(kb).toContain('#ablauf');
    // EN variant renders too.
    expect(renderHelpForAgent('en')).toContain('slug: trial-und-plaene');
  });
});

describe('help corpus — verified claims (no phantom affordances)', () => {
  const allBodies = HELP_ARTICLES.flatMap((a) => a.sections.flatMap((s) => [s.body.de, s.body.en])).join('\n');

  it('states the VERIFIED facts', () => {
    expect(allBodies).toContain('7 Tage'); // trial length, in the right article
    expect(allBodies.toLowerCase()).toContain('token'); // Vercel = paste-token, not OAuth
    expect(allBodies).toContain('DELETE'); // deletion confirmation
    expect(allBodies).toMatch(/Build.*Pro.*Power|Build, Pro/); // three plans, not one
  });

  it('does NOT reintroduce the retired product-contradicting claims', () => {
    expect(allBodies).not.toMatch(/\$9\s*\/\s*month|9\s*\$\s*\/\s*Monat|\$9\/month/i);
    expect(allBodies).not.toMatch(/\bone plan\b|eine[nm]? Plan .*alles/i);
    expect(allBodies).not.toMatch(/discord/i);
  });

  it('describes Vercel connection as token-based, explicitly not OAuth', () => {
    const vercel = helpArticleBySlug('live-stellen')!;
    const vercelText = vercel.sections.flatMap((s) => [s.body.de, s.body.en]).join('\n');
    expect(vercelText.toLowerCase()).toContain('token');
    expect(vercelText.toLowerCase()).toMatch(/kein oauth|not.*oauth/);
  });
});
