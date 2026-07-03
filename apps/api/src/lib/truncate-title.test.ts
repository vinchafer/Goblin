import { describe, it, expect } from 'vitest';
import { truncateTitle } from './truncate-title';

describe('truncateTitle (A4.2)', () => {
  it('keeps a leading umlaut intact', () => {
    const t = truncateTitle('Füge eine Einstellungs-Seite mit Dark-Mode-Umschalter hinzu, speichere die Wahl', 60);
    expect(t.startsWith('Füge')).toBe(true);
    expect(t).not.toContain('�');
    expect([...t].length).toBe(60);
  });

  it('never splits a surrogate pair at the cut boundary', () => {
    // 59 ASCII chars + emoji (2 UTF-16 code units) — a naive slice(0, 60)
    // would cut the pair in half and leave a lone surrogate.
    const title = 'a'.repeat(59) + '🚀 rest of the message';
    const t = truncateTitle(title, 60);
    expect(t).toBe('a'.repeat(59) + '🚀');
    expect(t).not.toContain('�');
    // round-trips through UTF-8 without loss
    expect(Buffer.from(t, 'utf8').toString('utf8')).toBe(t);
  });

  it('trims surrounding whitespace and leaves short titles untouched', () => {
    expect(truncateTitle('  Übersicht bauen  ', 60)).toBe('Übersicht bauen');
  });
});
