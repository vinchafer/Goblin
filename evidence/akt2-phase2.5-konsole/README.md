# AKT 2 · PHASE 2.5 — Konsolen-Belege

**Aufgenommen: 2026-07-29 · nachgetragen: 2026-08-13 (Akt-2-Konsistenzlauf)**

Dieser Ordner lag seit Phase 2.5 ohne README da — als einziger Akt-2-Belegordner. Hier steht,
was die fünf Dateien belegen und, wichtiger, **was sie nicht belegen**.

## Die Dateien

| Datei | Was sie ist |
|---|---|
| `measurements.json` | Der Messbericht des Harness. Die eigentliche Evidenz. |
| `konsole-healthy-de.png` / `-en.png` | Die Konsole im **guten** Zustand, 390 px, DE und EN. |
| `konsole-degraded-de.png` / `-en.png` | Die Konsole im **schlechten** Zustand, 390 px, DE und EN. |

## Was belegt ist

Aus `measurements.json`, vier Läufe, `failures: []`:

- **Kein horizontaler Overflow bei 390 px.** `docScrollWidth` und `bodyScrollWidth` sind in allen
  vier Läufen exakt `390` — die Konsole passt auf ein iPhone, ohne seitlich zu scrollen. Das ist der
  Grund, warum es dieses Harness gibt: der Gründer arbeitet vom iPhone.
- **Nichts ist abgeschnitten und kein Tap-Ziel ist zu klein.** `clipped: []` und `smallTargets: []`,
  viermal.
- **Beide Zustände sagen etwas Verschiedenes, und zwar vollständig.** Gut: 9 grüne Pillen, 0
  unbekannte. Schlecht: 0 grüne, 5 unbekannte. Der Punkt ist der Unterschied zwischen
  „**UNBEKANNT**" und „**NEIN**" — die Konsole behauptet nie, etwas sei aus, wenn sie es bloß nicht
  ermitteln konnte. Der Volltext steht in `measurements.json` unter `results[].text`.
- **Sechs Abschnitte** in jedem Lauf, in beiden Sprachen — kein Abschnitt fällt in einer Sprache weg.

## Was NICHT belegt ist — bitte lesen, bevor jemand daraus zitiert

- **Die Zustände sind Fixtures, keine Produktionsmessung.** „Gut" und „schlecht" sind die beiden
  synthetischen Enden, die dem Harness vorgegeben wurden, damit das Layout in beiden gemessen werden
  kann. Insbesondere ist die Zeile `0100 · Protokoll (ops_app_audit) ANGEWENDET` im *guten* Lauf
  **eine Fixture-Angabe und kein Beweis, dass Migration 0100 angewendet ist** — im *schlechten* Lauf
  steht dieselbe Zeile auf `NICHT ANGEWENDET`. Beides ist Eingabe, nicht Ergebnis. Der Punkt bleibt
  offen und steht als **B1** in `docs/ACT2_CARRY_FORWARD.md`.
- **`vinc.hafner3@gmail.com` ist das CC-Testkonto**, nicht die Betreiber-Identität und nicht das
  Konto des Gründers. Es steht in den Bildern und im Text, weil die Konsole anzeigt, wer angemeldet
  ist. Es sind keine Tokens, keine Schlüssel und keine Produktionsdaten in diesen Dateien.
- **Farben sind nicht geprüft.** Gemessen wurden Geometrie, Text und Vollständigkeit — nicht, ob die
  Palette stimmt.
- **Die Konsole von heute sieht anders aus.** Phase 3 hat die Prüflisten-Karte, den
  Entscheidungs-Verlauf und die Vorschau dazugebaut. Diese Bilder zeigen den Stand vom 2026-07-29.
  Aktueller Beleg: `evidence/akt2-phase3-konsole/`.

## Warum sich das hier nicht wiederholen lässt

**Das Skript, das diese Bilder erzeugt hat, wurde nie eingecheckt.** Diese vier PNGs lassen sich aus
dem Repo nicht reproduzieren — das ist der Grund, warum das Phase-3-Harness
(`apps/web/scripts/konsole-shots.mts`) eingecheckt **ist**. Steht als **E4** im Carry-forward.
