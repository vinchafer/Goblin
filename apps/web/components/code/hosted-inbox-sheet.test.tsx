/**
 * AKT 2 · PHASE 4 · U4.4 — the inbox says the things it is required to say.
 *
 * One defect is what this file is really about: THE SILENT EMPTY CARD. An inbox
 * that renders "nothing has arrived" when the truth is "nobody could look" tells an
 * owner their form is quiet while it may be full. So the empty state and the
 * unknown state are asserted as two different renders with two different testids,
 * two different sentences and two different colours — and a third test asserts they
 * cannot be confused, by checking that the empty branch's words never appear in the
 * unknown branch.
 *
 * The rest is wording, for the same reason the publish-sheet test is: the wording
 * is where the honesty invariants live, and it is what a careless later edit would
 * quietly soften.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'HostedInboxSheet.tsx'),
  'utf8',
);

describe('the empty state and the unknown state are different things', () => {
  it('renders them from two separate branches with two separate testids', () => {
    expect(SOURCE).toContain('data-testid="inbox-empty"');
    expect(SOURCE).toContain('data-testid="inbox-unknown"');
  });

  it('the UNKNOWN state says it could not look — and never that nothing is there', () => {
    expect(SOURCE).toContain('Das heißt NICHT, dass nichts da ist');
    expect(SOURCE).toContain('That does NOT mean nothing is there');
  });

  it('the EMPTY state is calm and says the form is working', () => {
    expect(SOURCE).toContain('Noch keine Einsendungen.');
    expect(SOURCE).toContain('nimmt entgegen');
  });

  it('the unknown state is styled as a warning, the empty state is not', () => {
    // The two branches share no styling: one is a dashed danger-coloured box, the
    // other is the same neutral card as a submission. A single shared style is how
    // these two would drift back into looking alike.
    const unknownBlock = SOURCE.slice(SOURCE.indexOf('data-testid="inbox-unknown"'), SOURCE.indexOf('data-testid="inbox-list"'));
    expect(unknownBlock).toContain('--danger');
    const emptyBlock = SOURCE.slice(SOURCE.indexOf('data-testid="inbox-empty"'), SOURCE.indexOf('data-testid="inbox-list"'));
    expect(emptyBlock).not.toContain('--danger');
  });

  it('the unknown state offers a retry — the owner is not left at a dead end', () => {
    expect(SOURCE).toContain('Nochmal versuchen');
  });
});

describe('the owner’s powers are all present, and the destructive one is confirmed', () => {
  it('mark-read, delete one, delete all, export', () => {
    for (const id of ['inbox-mark-read', 'inbox-delete-one', 'inbox-delete-all', 'inbox-export']) {
      expect(SOURCE).toContain(`data-testid="${id}"`);
    }
  });

  it('delete-all is a two-step, and the first step names the number and the finality', () => {
    expect(SOURCE).toContain('data-testid="inbox-delete-all-confirm"');
    expect(SOURCE).toContain('endgültig');
    expect(SOURCE).toContain('Exportiere sie vorher');
  });

  it('the confirm token is sent to the server — the dialog is not the only guard', () => {
    expect(SOURCE).toContain('confirm=ALLES-LOESCHEN');
  });

  it('export is disabled when there is nothing to export — no phantom affordance', () => {
    expect(SOURCE).toContain('disabled={busy === "csv" || state.body.total === 0}');
  });

  it('a truncated export SAYS it is truncated instead of looking complete', () => {
    expect(SOURCE).toContain('x-goblin-export-truncated');
    expect(SOURCE).toContain('es sind mehr da');
  });
});

describe('the month is a measured number, never a forecast', () => {
  it('an unreadable counter says so rather than showing a zero', () => {
    expect(SOURCE).toContain('liess sich gerade nicht feststellen');
    expect(SOURCE).toContain('acceptedThisMonth === null');
  });
});

describe('whose data this is, said out loud', () => {
  it('names the responsibility and the fact that Goblin did not check the content', () => {
    expect(SOURCE).toContain('Goblin hat den Inhalt nicht geprüft');
    expect(SOURCE).toContain('verantwortlich');
  });

  it('is bilingual throughout — every visible string goes through t(lang, de, en)', () => {
    // `t(lang, de, en)` is this project's i18n; there is no key file, so "0 missing
    // keys" means "no user-visible string is single-language".
    //
    // The check that actually bites: no German text is rendered as a bare JSX text
    // node. `>Löschen<` would be a string a English-speaking user still sees in
    // German, and it is the exact shape a hurried edit produces.
    const bareJsxText = SOURCE.match(/>[^<>{}\n]*[äöüßÄÖÜ][^<>{}\n]*</g) ?? [];
    expect(bareJsxText).toEqual([]);

    // And every sentence the owner reads is paired.
    const paired = SOURCE.match(/t\(lang,/g) ?? [];
    expect(paired.length).toBeGreaterThan(20);
  });
});

describe('mobile first', () => {
  it('is sized for a 390px phone', () => {
    expect(SOURCE).toContain('min(390px, calc(100% - 24px))');
  });

  it('uses design tokens, never raw hex, for anything structural', () => {
    // The one hex in the file is the fallback inside `var(--danger, #B0432A)` —
    // the same pattern the publish sheet already uses.
    const hexes = SOURCE.match(/#[0-9a-fA-F]{6}/g) ?? [];
    for (const hex of hexes) {
      expect(SOURCE).toContain(`var(--danger, ${hex})`);
    }
  });
});
