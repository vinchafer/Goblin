# AKT 2 · X1-S — die Waisen-Prüfung in der Konsole

**Erzeugt: 2026-08-13 · gegen master `31d2290` (enthält PR #89 und #90) plus diese Einheit**

Was hier liegt, ist der Beweis für die eine Eigenschaft, wegen der diese Karte gebaut wurde:
**`null` sieht nicht aus wie `0`.** Alles andere an ihr ist gewöhnlich.

## Der Befehl

```bash
pnpm --filter @goblin/web exec tsx scripts/konsole-shots.mts evidence/akt2-x1s-konsole
```

Auf dieser Maschine lief er als `node --experimental-strip-types scripts/konsole-shots.mts <out>`,
weil `tsx` hier nicht installiert ist — dasselbe Skript, derselbe Pfad, nur ein anderer Starter.
Und mit gesetztem `PW_CHROMIUM_PATH`, siehe Carry-forward **E5**: ohne den Pfad findet Playwright
den Browser nicht und das Harness bricht ab. Hier war es
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

## Die Dateien

| Datei | Was sie zeigt |
|---|---|
| `orphancard-390-healthy-de.png` / `-en.png` | Der **gemischte** Bericht: eine gefundene KV-Route (rot, „1 GEFUNDEN"), eine geprüfte Null (grün, „KEINE GEFUNDEN") und ein `null` (gestrichelt, farblos, „NICHT GEPRÜFT") — **alle drei nebeneinander in einer Karte.** Genau dafür ist der Stub gemischt und nicht grün. |
| `orphancard-390-degraded-de.png` / `-en.png` | Jedes Feld `null`. Das ist das Bild, das ein still grün gewordenes `null` auffliegen ließe. Auch die Zählungen stehen auf UNBEKANNT, nicht auf 0. |
| `konsole-390-*.txt` | DOM-Dump der ganzen Seite je Szenario und Sprache. Ein Pixel-Diff sagt „etwas hat sich geändert", der Text sagt **was**. |

Die `.txt`-Dateien mussten mit `git add -f` eingecheckt werden — `.gitignore:2` ist `*.txt`. Das
ist die Falle aus Carry-forward **E1**; sie steht unverändert, also gilt die Regel weiter.

## Was das Harness sonst noch schreibt, und warum es hier nicht liegt

Derselbe Lauf erzeugt auch `konsole-390-*.png` (ganze Seite, ~14 000 px hoch) und
`reviewcard-390-*.png`. Beides ist Phase-3-Evidenz und liegt bereits in
`evidence/akt2-phase3-konsole/`; es hier ein zweites Mal abzulegen hieße, dieselben Bilder mit zwei
Datumsangaben zu führen. Der Lauf ist reproduzierbar — wer sie braucht, erzeugt sie neu.

## Zwei Vorbehalte, unverändert gültig

- **Die Farben sind nicht die finalen.** Das Harness rendert die *Karte*, nicht die *Seite* — es
  fehlt die Dashboard-Hülle. Layout bei 390 px und Wortlaut sind belegt, ein Farburteil ist es
  nicht. Das ist Carry-forward **B3**, und diese Bilder ändern daran nichts.
- **Die Hinweiszeilen bleiben deutsch, auch im englischen Screenshot.** Sie sind die Worte der
  API selbst und werden absichtlich unübersetzt durchgereicht — dieselbe Regel wie bei den
  `founderAction`-Texten des Router-Checks: wer eine Fehlerursache weitergibt, paraphrasiert sie
  nicht.

## Was diese Bilder **nicht** zeigen

Sie zeigen die Karte gegen einen **Stub**, nicht gegen Produktion. Ob es heute echte Waisen gibt,
sagt keiner dieser Screenshots — das sagt nur ein echter Lauf der Karte im Gründer-Fenster, und
genau der ist X1-S.
