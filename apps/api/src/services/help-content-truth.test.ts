// FW4 U6 (F-37): "docs travel with features." The help corpus claims Goblin runs a
// post-deploy TRUTH check before "Live ✓". This pins that claim to what the code
// ACTUALLY does in deploy-verification.ts, so the article can never drift into an
// overclaim. Verdict (2026-07-15): the claim is ACCURATE — all three checks run:
//   (a) entry HTML answers 200            deploy-verification.ts:76-80  (fetchOk → res.ok)
//   (b) served HTML matches the artifact  deploy-verification.ts:82-85  (servedHtml !== expectedEntry)
//   (c) every linked local asset 200      deploy-verification.ts:88-98  (refs → fetchOk)
//   + honest per-failure cause + ~1min/6-attempt window (ATTEMPTS=6, RETRY_DELAY_MS=10s)
// So per F-37 we KEEP the claim and cite it precisely (no rewrite needed).

import { describe, it, expect } from 'vitest';
import { renderHelpForAgent } from '@goblin/shared/src/help-content';

describe('F-37 — the post-deploy verification claim matches the code', () => {
  const help = renderHelpForAgent('de');

  it('claims exactly the three checks the code performs, no more', () => {
    // (a) HTTP 200 reachability
    expect(help).toMatch(/HTTP 200/);
    // (b) matches the saved/stored state (content compare)
    expect(help).toMatch(/gesicherten Stand|gespeicherten Stand|überein/);
    // (c) linked files (images/scripts/styles) load
    expect(help).toMatch(/verlinkten Dateien|Bilder.*Skripte.*Styles|laden alle/);
  });

  it('states the honest failure behaviour + the bounded retry window', () => {
    // names the exact failing file/check on failure (no faith-based "Live")
    expect(help).toMatch(/genaue Ursache|welche Datei|welcher Check/);
    // ~1 minute / 6 attempts — matches ATTEMPTS=6 · RETRY_DELAY_MS=10s
    expect(help).toMatch(/6 Versuche|~?1 Minute/);
    // and it does NOT claim "Live" before the check passes
    expect(help).toMatch(/nicht auf gut Glück|Erst dann/);
  });
});
