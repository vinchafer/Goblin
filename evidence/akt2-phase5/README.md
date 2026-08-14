# AKT 2 · PHASE 5 — Evidenz zum Heartbeat (K0)

**Erzeugt: 2026-08-14 · Branch `claude/keeper-1a-heartbeat-status-aa8wgj`**

## `induced-failure.json` — U5.6, das Kopf-Gate der Phase

**Wie es entstanden ist, reproduzierbar:**

```
pnpm --filter @goblin/api keeper:induced-failure
```

Derselbe Lauf läuft in der Testsuite als
`apps/api/src/services/ops-check-induced-failure.test.ts` — ein Harness, das nur läuft, wenn jemand
daran denkt, ist ein Harness, das verrottet.

**Was gemessen wird, und mit welchem Code.** Der Harness fährt den **ausgelieferten** Läufer
(`runCheckTick`) und die **ausgelieferte** Zustandsableitung (`deriveState`). Ersetzt sind genau zwei
Dinge, und beide sind Steckdosen, keine Logik:

| Ersetzt | Wodurch | Was dadurch trotzdem echt geprüft wird |
|---|---|---|
| Der HTTP-Transport | ein lokaler Server, der auf Kommando 200 oder 503 antwortet | URL-Bau (`appUrl`), Status-Deutung, Transport-Fehler-Klassifizierung |
| Der Speicher | ein Array im Prozess | Debounce, Frische-Regel, Zustandsableitung, Fälligkeits-Logik |

**Was der Harness NICHT beweist:** irgendetwas über Produktion. Er zeigt, dass der Mechanismus
reagiert wie entworfen. Über Cloudflare, den Router, KV oder R2 sagt er **nichts** — das ist die
Aufgabe des Gründer-Fensters (Teil C in `docs/AKT2_PHASE3_UND_4_FOUNDER_WINDOW.md`).

### Die Zahlen, wie sie gemessen wurden

| Größe | Lauf 1 | Lauf 2 | Lauf 3 |
|---|---|---|---|
| Zyklen bis zum ersten Signal (`degraded`) | 1 | 1 | 1 |
| Zyklen bis `down` | **2** | **2** | **2** |
| Zyklen bis zur Erholung (`healthy`) | **2** | **2** | **2** |

Takt im Lauf: **5 Minuten**. Frische-Schwelle: **20 Minuten** (drei verpasste Ticks, mit der
Untergrenze aus `MIN_FRESHNESS_MS`).

**In Minuten, für das Fenster:** ein Ausfall wird nach **≤ 5 Minuten** als *eingeschränkt* sichtbar
und nach **≤ 10 Minuten** als *nicht erreichbar*. Die Erholung braucht ebenfalls **≤ 10 Minuten**.
Beides folgt aus dem Debounce von zwei und ist nicht behauptet, sondern in den `observations`
Zyklus für Zyklus nachlesbar.

**3/3 Läufe stimmen überein** (`consistent: true`). Jeder Lauf startet mit leerer Historie, damit
Lauf 2 nicht von Lauf 1 erbt.

### Der UNBEKANNT-Pfad

```json
{
  "whileRunning":     "healthy",
  "whilePaused":      "unknown",
  "pausedReason":     "stale",
  "pausedMeasuredAt": "2026-08-14T13:25:00.000Z",
  "afterResume":      "healthy"
}
```

**Das ist das eigentliche Gate.** Während der Pause hat sich an der App **nichts** geändert — sie
liefert weiter 200 aus. Geändert hat sich, dass **wir aufgehört haben nachzusehen**. Der Zustand
wird deshalb UNBEKANNT und nicht „alles gut", und der Zeitstempel der letzten echten Messung bleibt
stehen, damit die Lücke **datiert** ist statt leer.

Verlassen wird UNBEKANNT ausschließlich durch neue Messungen (`afterResume: healthy`).

---

## Was hier NICHT liegt, und warum

- **Keine Screenshots.** Diese Sitzung kann die Karte nicht rendern: das Konsolen-Harness
  (`konsole-shots.mts`) braucht einen Browser-Pfad (Carry-forward **E5**), und die Besitzer-Karte
  hängt an einer angemeldeten Sitzung hinter `opsGate`. Der Wortlaut der Karte ist statt dessen
  **direkt getestet** (`apps/web/components/code/hosted-status-card.test.tsx`), einschließlich der
  Eigenschaft, dass keine Zustandsaussage ohne ihren Messzeitpunkt entstehen kann.
- **Keine Produktionszeilen.** Migration `0103` ist nicht angewendet, kein Tick ist in Produktion
  gelaufen, keine Zeile ist geschrieben worden.
- **Keine `.txt`-Dateien.** `.gitignore:2` ist `*.txt` und hat in Phase 3 schon einmal Evidenz
  verschluckt (Carry-forward **E1**). Alles hier ist `.json` oder `.md`.
