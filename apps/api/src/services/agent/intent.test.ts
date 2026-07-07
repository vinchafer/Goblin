// FEEL-3b B2 gate: the intent matrix (D1). Explicit action phrases grant publish;
// absent OR ambiguous signals do NOT (→ draft + confirmation chip, never a guess).
// Two phrasings per class, DE + EN, case/Umlaut/diacritic-robust.

import { describe, it, expect } from 'vitest';
import { classifyPublishIntent } from './intent';

describe('publish intent — D1 matrix', () => {
  it('EXPLICIT (DE): a clear "live/veröffentlichen" request grants publish', () => {
    expect(classifyPublishIntent('Baue eine Mini-Umfrage-Seite und stell sie live.')).toBe('explicit');
    expect(classifyPublishIntent('Füge Dark-Mode hinzu und sag mir wenn es live ist.')).toBe('explicit');
    expect(classifyPublishIntent('Veröffentliche das jetzt bitte.')).toBe('explicit');
    expect(classifyPublishIntent('Kannst du die Seite online stellen?')).toBe('explicit');
  });

  it('EXPLICIT (EN): go live / ship it / publish grant publish', () => {
    expect(classifyPublishIntent('Build the page and make it live.')).toBe('explicit');
    expect(classifyPublishIntent('Add a settings page and tell me when it\'s live.')).toBe('explicit');
    expect(classifyPublishIntent('ship it')).toBe('explicit');
    expect(classifyPublishIntent('publish the site')).toBe('explicit');
  });

  it('ABSENT: pure build/edit requests do NOT grant publish', () => {
    expect(classifyPublishIntent('Baue eine kleine Zähler-App.')).toBe('none');
    expect(classifyPublishIntent('Ändere die Frage auf "Kaffee oder Tee?"')).toBe('none');
  });

  it('AMBIGUOUS: weak "live"/"online" mentions do NOT grant (→ chip, never guess)', () => {
    expect(classifyPublishIntent('Sieht die Live-Vorschau gut aus?')).toBe('none');
    expect(classifyPublishIntent('Kannst du mir das Ergebnis online zeigen?')).toBe('none');
    expect(classifyPublishIntent('Ist die Seite eigentlich schon online?')).toBe('none');
  });

  it('robust to casing, Umlaut spelling, and curly apostrophes', () => {
    expect(classifyPublishIntent('STELL ES LIVE')).toBe('explicit');
    expect(classifyPublishIntent('veroeffentliche es')).toBe('explicit'); // ö written as oe
    expect(classifyPublishIntent('tell me when it’s live')).toBe('explicit'); // curly apostrophe
  });
});
