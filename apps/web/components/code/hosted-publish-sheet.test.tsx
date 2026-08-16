/**
 * AKT 2 · PHASE 3 · U3.4 — the hosted sheet says the things it is required to say.
 *
 * The sheet's behaviour (debounced name check, publish, review) is exercised by
 * the founder window against the real API; what is worth pinning in a unit test is
 * the WORDING, because the wording is where the honesty invariants live and it is
 * what a careless later edit would quietly soften.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HostedPublishSheet } from './HostedPublishSheet';

const SOURCE = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'HostedPublishSheet.tsx'), 'utf8');

// `useLang` defaults to German with no localStorage, which is the product default.
const html = renderToStaticMarkup(
  <HostedPublishSheet
    projectId="p1"
    appsDomain="justgoblin.app"
    onUseVercel={() => {}}
    onClose={() => {}}
    onPublished={() => {}}
  />,
);

describe('the hosted path is the visible default', () => {
  it('leads with the hosted address and with "nothing to connect"', () => {
    expect(html).toContain('Live auf {name}.justgoblin.app — nichts zu verbinden');
  });

  it('offers a name field against the real apps domain', () => {
    expect(html).toContain('data-testid="hosted-name"');
    expect(html).toContain('.justgoblin.app');
  });

  it('says the check is NOT a reservation', () => {
    // The affordance this sentence prevents: someone typing a name, reading
    // "frei", and believing they now hold it.
    expect(html).toContain('Die Prüfung ist keine Reservierung');
  });

  it('disables publish with no name AND says why — no phantom affordance', () => {
    expect(html).toContain('Erst einen Namen eingeben.');
    expect(html).toMatch(/disabled="" data-testid="hosted-publish"/);
  });
});

// ── FOUNDER-WALK-6 · U4 (F5) — the beta badge ───────────────────────────────
//
// The founder saw this sheet's hosted default and briefly believed his whole
// cohort saw the same thing. It does not — this sheet is allowlist-gated —
// and nothing here said so. The fix is the smallest honest marker: a static
// badge, since by the time this component mounts eligibility is already an
// established fact (SessionPane dynamic-imports it only after a confirmed
// `hosted:true`), so no new prop or API call is needed to show it.
describe('the beta badge', () => {
  it('says the hosted default is beta and account-gated', () => {
    expect(html).toContain('Beta — nur für ausgewählte Konten sichtbar');
  });

  it('appears between the hosted intro and the name field — where the founder was looking', () => {
    const badge = html.indexOf('Beta — nur für ausgewählte Konten sichtbar');
    const intro = html.indexOf('Goblin hostet deine App selbst');
    const nameField = html.indexOf('data-testid="hosted-name"');
    expect(intro).toBeGreaterThan(-1);
    expect(badge).toBeGreaterThan(intro);
    expect(badge).toBeLessThan(nameField);
  });

  it('has an English counterpart', () => {
    expect(SOURCE).toContain('Beta — visible to selected accounts only');
  });
});

describe('the Vercel path stays intact beside it', () => {
  it('offers it by name, marked as the advanced route', () => {
    expect(html).toContain('Eigenes Vercel verbinden (für Fortgeschrittene)');
    expect(html).toContain('data-testid="hosted-use-vercel"');
  });

  it('keeps the sentence about whose account and whose cost it is', () => {
    expect(html).toContain('Deine Seite läuft dann in deinem eigenen Vercel-Account');
  });
});

describe('German + English', () => {
  it.each([
    ['Live at {name}.', 'the hosted lead'],
    ['Connect your own Vercel (advanced)', 'the Vercel route'],
    ['Checking is not reserving', 'the not-a-reservation note'],
    ['This name is free.', 'the available answer'],
    ['This name is taken.', 'the unavailable answer'],
    ['Enter a name first.', 'the disabled reason'],
    ['Beta — visible to selected accounts only', 'the beta badge'],
  ])('has an English counterpart for %s (%s)', (english) => {
    expect(SOURCE).toContain(english);
  });

  it('has no user-visible string outside a t(…) pair', () => {
    // Every literal the user reads goes through t(de, en). A bare German string
    // in JSX would render for English readers too — the failure the konsole's
    // strings.test.ts catches by typing, caught here by construction instead.
    const jsxText = SOURCE.match(/>\s*[A-ZÄÖÜ][^<>{}\n]{6,}\s*</g) ?? [];
    expect(jsxText).toEqual([]);
  });
});

describe('honest verdict handling', () => {
  it('renders the server’s own German for a held publish and writes none of its own', () => {
    // The review sentence comes from the API (review-messages.ts). This component
    // must not author a second one that could drift from it.
    expect(SOURCE).toContain('outcome.message');
    expect(SOURCE).not.toContain('wartet auf einen kurzen Blick');
  });

  it('shows the server’s verified URL rather than composing one', () => {
    expect(SOURCE).toContain('{outcome.url}');
    // No `https://${name}.${appsDomain}` anywhere in the live branch — the one
    // place that shape appears is the name-check fallback, which is a preview of
    // an address, not a claim that something is live.
    expect(SOURCE).not.toMatch(/kind: "live", url: `https:/);
  });
});
