/**
 * AKT 2 · PHASE 5 · U5.3 — the status card says the things it is required to say.
 *
 * ONE DEFECT is what this file is really about: A STATE WITHOUT ITS MEASUREMENT
 * TIME. "Erreichbar" on its own is a claim with no date on it — unfalsifiable, and
 * therefore worthless, and therefore exactly the green dot every competitor ships.
 *
 * `stateLine()` is exercised directly rather than grepped, because it is the one
 * function that can produce a state word and it is a pure function. Every state it
 * can return is asserted to carry a time, so a later edit that drops the timestamp
 * from a branch fails here rather than shipping.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ageLabel, spanLabel, stateLine } from './HostedStatusCard';

const SOURCE = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'HostedStatusCard.tsx'), 'utf8');

const NOW = Date.parse('2026-08-14T14:05:00.000Z');
const AT_1402 = '2026-08-14T14:02:00.000Z';
/** The clock string in the runner's own zone, so the assertion is not TZ-fragile. */
const CLOCK = new Date(AT_1402).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

describe('THE gate — no state is ever rendered without its measurement time', () => {
  const CASES = [
    ['healthy', 'all_ok'],
    ['degraded', 'mixed'],
    ['down', 'sustained_failure'],
    ['unknown', 'stale'],
    ['unknown', 'inconclusive'],
  ] as const;

  it.each(CASES)('%s/%s carries the measurement time in the sentence', (state, reason) => {
    const de = stateLine(state, reason, AT_1402, NOW, 'de');
    const en = stateLine(state, reason, AT_1402, NOW, 'en');
    expect(de).toContain(CLOCK);
    expect(en).toContain(CLOCK);
  });

  it('the ONLY sentence without a time makes no claim about the app at all', () => {
    // `measuredAt: null` is reachable only for never_checked. The sentence must
    // therefore not contain a state word — it says we have not looked.
    const de = stateLine('unknown', 'never_checked', null, NOW, 'de');
    expect(de).toContain('Noch nie geprüft');
    expect(de).not.toMatch(/erreichbar|in Ordnung/i);
    expect(stateLine('unknown', 'never_checked', null, NOW, 'en')).toContain('Never checked yet');
  });

  it('the healthy sentence is the documented shape: "Zuletzt geprüft 14:02 — erreichbar"', () => {
    expect(stateLine('healthy', 'all_ok', AT_1402, NOW, 'de')).toBe(`Zuletzt geprüft ${CLOCK} — erreichbar.`);
  });
});

describe('UNKNOWN is honest about which kind of blindness it is', () => {
  it('a gap in the checks says we did not look — and says that is not a fault of the app', () => {
    const de = stateLine('unknown', 'stale', AT_1402, NOW, 'de');
    expect(de).toContain('Wir wissen es gerade nicht');
    expect(de).toContain('Das heißt NICHT, dass etwas kaputt ist');
    expect(stateLine('unknown', 'stale', AT_1402, NOW, 'en')).toContain('That does NOT mean something is broken');
  });

  it('an inconclusive check says it was on us', () => {
    expect(stateLine('unknown', 'inconclusive', AT_1402, NOW, 'de')).toContain('das lag an uns, nicht an deiner App');
    expect(stateLine('unknown', 'inconclusive', AT_1402, NOW, 'en')).toContain('that was on us, not on your app');
  });

  it('UNKNOWN never uses the words of either good or bad news', () => {
    for (const reason of ['stale', 'inconclusive'] as const) {
      const de = stateLine('unknown', reason, AT_1402, NOW, 'de');
      expect(de).not.toMatch(/^Zuletzt geprüft .* — erreichbar/);
      expect(de).not.toContain('nicht erreichbar.');
    }
  });

  it('UNKNOWN is styled colourless and dashed — it is not an alarm', () => {
    // Red would train the owner to ignore red. The dashed, colourless treatment is
    // the same language the founder console uses for UNBEKANNT.
    expect(SOURCE).toContain('dashed: true');
    expect(SOURCE).toMatch(/default:\s*\n\s*return \{ fg: "var\(--ed-fg-3\)"/);
  });
});

describe('the debounce is disclosed rather than hidden', () => {
  it('one failure reads as impaired, and says why it is not called an outage', () => {
    expect(stateLine('degraded', 'mixed', AT_1402, NOW, 'de')).toContain('eingeschränkt');
    expect(stateLine('down', 'sustained_failure', AT_1402, NOW, 'de')).toContain('Zwei Prüfungen hintereinander');
  });

  it('the card states the two-check rule and the cadence in its own copy', () => {
    // An undisclosed delay is a lie about freshness. One sentence buys it back.
    expect(SOURCE).toContain('zwei Prüfungen hintereinander fehlgeschlagen sind');
    expect(SOURCE).toContain('two consecutive failed checks');
    expect(SOURCE).toContain('Goblin sieht etwa alle ${body.cadenceMinutes} Minuten nach');
  });

  it('the card says outright that it only shows what was measured', () => {
    expect(SOURCE).toContain('Hier steht nur, was gemessen wurde');
    expect(SOURCE).toContain('sagt dann UNBEKANNT statt zu raten');
  });
});

describe('the uptime figure cannot become a flattering number', () => {
  it('a null ratio renders as "not enough data", never as 0 %', () => {
    expect(SOURCE).toContain('uptime.ratio === null');
    expect(SOURCE).toContain('reichen die Daten noch nicht');
    expect(SOURCE).toContain('Not enough data for an availability figure yet');
  });

  it('the ratio is never shown without its sample count', () => {
    expect(SOURCE).toContain('aus ${uptime.measured} Messungen');
    expect(SOURCE).toContain('from ${uptime.measured} measurements');
  });

  it('the excluded inconclusive checks are named out loud', () => {
    expect(SOURCE).toContain('uptime.inconclusive > 0');
    expect(SOURCE).toContain('kamen zu keinem Ergebnis und zählen nicht mit');
    expect(SOURCE).toContain('reached no verdict and are not counted');
  });

  it('the coverage actually measured is shown, so a 2-day number is not called 7 days', () => {
    expect(SOURCE).toContain('spanLabel(uptime.coveredMs, lang)');
  });
});

describe('the store being unreadable is its own state, not an empty card', () => {
  it('has a separate branch with its own words', () => {
    expect(SOURCE).toContain('data-testid="hosted-status-store-unavailable"');
    expect(SOURCE).toContain('nicht „alles in Ordnung“');
    expect(SOURCE).toContain('data-testid="hosted-status-unreachable"');
    expect(SOURCE).toContain('Das sagt nichts darüber, ob deine App läuft');
  });
});

describe('the card measures nothing itself', () => {
  it('only reads the status endpoint — no probe, no publish, no write', () => {
    // A card that probed on open would show a fresh green for an app that had been
    // dark for hours: the freshest possible answer to the wrong question.
    expect(SOURCE).toContain('apiGet<StatusBody>(`/api/ops/apps/${appId}/status`)');
    expect(SOURCE).not.toContain('apiPost');
    expect(SOURCE).not.toMatch(/method:\s*"(POST|PUT|DELETE)"/);
  });
});

describe('helpers', () => {
  it('ageLabel reads as an age in both languages', () => {
    expect(ageLabel(new Date(NOW - 20_000).toISOString(), NOW, 'de')).toBe('gerade eben');
    expect(ageLabel(new Date(NOW - 3 * 60_000).toISOString(), NOW, 'de')).toBe('vor 3 Min.');
    // Rounds AWAY from freshness: 30 seconds reads as a minute, never as "just
    // now". Overstating an age is the safe direction; understating it would make a
    // stale measurement look current, which is the one error this card may not make.
    expect(ageLabel(new Date(NOW - 30_000).toISOString(), NOW, 'de')).toBe('vor 1 Min.');
    expect(ageLabel(new Date(NOW - 5 * 3_600_000).toISOString(), NOW, 'en')).toBe('5 h ago');
    expect(ageLabel(new Date(NOW - 3 * 86_400_000).toISOString(), NOW, 'de')).toBe('vor 3 Tagen');
  });

  it('spanLabel never rounds a short span up into a reassuring one', () => {
    expect(spanLabel(20 * 60_000, 'de')).toBe('weniger als eine Stunde');
    expect(spanLabel(30 * 3_600_000, 'de')).toBe('30 Stunden');
    expect(spanLabel(50 * 3_600_000, 'en')).toBe('2 days');
  });
});

describe('DE/EN parity', () => {
  it('every sentence the card can produce exists in both languages', () => {
    // `t(lang, de, en)` is the only string mechanism here, so parity means: no
    // call with an empty second or third argument, and no bare German literal in
    // a render position.
    expect(SOURCE).not.toMatch(/t\(lang,\s*""/);
    expect(SOURCE).not.toMatch(/t\(lang,\s*[^,]+,\s*""\s*\)/);
    for (const [state, reason] of [
      ['healthy', 'all_ok'],
      ['degraded', 'mixed'],
      ['down', 'sustained_failure'],
      ['unknown', 'stale'],
      ['unknown', 'inconclusive'],
    ] as const) {
      const de = stateLine(state, reason, AT_1402, NOW, 'de');
      const en = stateLine(state, reason, AT_1402, NOW, 'en');
      expect(de.length).toBeGreaterThan(0);
      expect(en.length).toBeGreaterThan(0);
      expect(de).not.toBe(en);
    }
  });
});
