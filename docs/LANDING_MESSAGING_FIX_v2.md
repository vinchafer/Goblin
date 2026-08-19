# Goblin — Landing-Messaging-Fix v2

**2026-08-18 · ersetzt v1 vollständig**
Evidenz: 19 Screenshots der Live-Seite (EN, iPhone, 375 px, 2026-08-18 20:32–20:33)
+ Review eines IT-Technikers aus der ersten Kohorte.

**Status: umgesetzt.** Implementierungs-Protokoll siehe Anhang A.

---

## 0 · Korrektur an v1 (Gesetz 2: Evidenz schlägt Vermutung)

v1 wurde ohne Seitenzugriff geschrieben und behauptete: „Die Landing Page sagt
nirgends, wo Goblin läuft." **Das war falsch.** Der Satz existiert, im Wortlaut
fast exakt so, wie v1 ihn vorgeschlagen hat:

> „Installing Goblin puts the workshop on your home screen — *the AI itself runs
> in Goblin's cloud.* Your phone is the remote control, not the server. Nothing
> to download, nothing your device has to be powerful enough for."

Der Befund wird dadurch **schlimmer, nicht besser.** Die richtige Antwort steht
auf der Seite — und ein wohlwollender, technisch denkender Leser hat sie trotzdem
nicht mitgenommen. Das ist kein Copy-Problem mehr. Das ist ein **Hierarchie- und
Kompositionsproblem.**

---

## 1 · Die Seitenstruktur vor dem Fix

| Pos | Abschnitt | Was zum Ausführungsmodell gesagt wurde |
|---|---|---|
| 1 | Hero — „Tell it what you want. It ships." | „The cloud workshop…", **„The AI is built in"**, „Build on any device" |
| 2 | Trial-Strip | — |
| 3 | Install-Absatz (`AiLocationNote`) | **Die vollständige, korrekte Antwort** — ohne Überschrift, ohne Rahmen, in Serif-Kursiv |
| 4 | „POWER USERS — BRING YOUR OWN FRONTIER" + 7 Anbieter | **Widerspricht Pos. 1 visuell** |
| 5 | 01/05 THE PROBLEM — vier Wände, u.a. **„Hardware wall"** | Verstärkt die Hardware-Fährte |
| 6 | 02/05 HOW IT WORKS | „Log in from any device" |
| 7 | 03/05 THE PRODUCT — echter Screen | — |
| 8 | THE AGENT — Plan / Writes files / **Checks & self-heals** / Goes live | — |
| 9 | 04/05 THE ISLAND FLOW | „Works on any device, from anywhere" |
| 10 | 05/05 PRICING | **„Goblin Swift + Forge included — no key, no token counter"** |
| 11 | FAQ (eingeklappt) | „What AI models can I use?", „Can I use Goblin on my phone?" |
| 12 | Closing/Footer | **„tools built for \$3,000 laptops"** |

Die Antwort auf „was läuft wo, mit wessen Modell" war über fünf Positionen
(1, 3, 4, 10, 11) verstreut und wurde an keiner einzigen als eigenständige
Aussage geführt. Der Reviewer hörte auf zu sammeln, bevor er bei Position 10
ankam — deshalb tauchen Swift und Forge in seinem Review nicht auf, obwohl sie
die Antwort auf seine Frage sind.

---

## 2 · Findings-Register

| # | Schwere | Finding | Status |
|---|---|---|---|
| **L-1** | **P0** | **Der Anker trug das Kostüm der Dekoration.** „the AI itself runs in Goblin's cloud" stand in Instrument-Serif-Kursiv — auf dieser Seite durchgängig der **Zier-Akzent** der Headlines. Die Seite hatte dem Auge beigebracht, Kursiv als Schmuck zu lesen. | ✅ behoben (U2) |
| **L-2** | **P0** | **Der Anbieter-Strip stand an der falschen Stelle und war lauter als die Wahrheit.** Sieben Anbieternamen direkt unter dem Cloud-Absatz. Namen sind visuell lauter als Fliesstext. **Layer-Reihenfolge invertiert: Layer 3 gezeigt, Layer 1 erzählt.** | ✅ behoben (U2) |
| **L-3** | **P0** | **„The AI is built in" ist zweideutig.** *Eingebaut wo?* Mit „Build on any device" liest es sich als *im Gerät eingebettet*. | ✅ behoben (U1) |
| **L-4** | **P1** | **„Hardware wall" (P·02) säte die falsche Fährte auf Produktebene.** Die Wand ist nicht Rechenleistung, sondern ein eingerichteter Entwicklerrechner. | ✅ behoben (U1) |
| **L-5** | **P1** | **Footer restatete dieselbe Fährte:** „tools built for \$3,000 laptops". | ✅ behoben (U1) |
| **L-6** | **P1** | **Swift + Forge existierten erst ab Position 10.** Ein oben verwirrter Leser kommt dort nie an. | ✅ behoben (U2) |
| **L-7** | **P1** | **FAQ ist Bestätigungs-, nicht Lernort.** Eingeklappt an Position 11. | ✅ entschärft (U2) — die Antwort steht jetzt an Position 2; das FAQ bleibt Bestätigung |
| **L-8** | **P1** | **„Claude Pro locks you out after two hours."** Namentlich benannte Fremdproduktbehauptung mit konkreter Zahl, die altert. | ✅ behoben (U1, D-4) |
| **L-9** | **P1** | **„Checks & self-heals" — Begriffskollision** mit dem K3-Keeper-Begriff, gesperrt bis Hire-1. | ✅ behoben (U1, D-5) |
| **L-10** | **P2** | **Der String „install Goblin as an app" war in den 19 Screenshots nicht auffindbar.** Quelle offen. | ✅ geklärt: `components/landing/sections/InstallAppBlock.tsx` — die PWA-Install-Karte, die client-seitig rendert und sich versteckt, sobald Goblin installiert ist. Deshalb fehlte sie in der Screenshot-Serie. |
| **L-11** | **P2** | **Nur die EN-Seite ist begangen.** Alle Fixes brauchen den DE-Key. | ⚠️ **korrigiert — siehe Anhang B.** Es gibt keine DE-Landing und keinen DE-Key. |
| **L-12** | **P2** | Die WhatsApp-Einladung trägt den Anker nicht. | 🔲 offen — Founder-kontrolliert, kein Code |

**Was ausdrücklich gut ist und bleibt** (nicht angefasst): „This is the real
screen, drawn from the app's own code rather than staged" · „≈ 116 Builds /
month — varies by complexity" mit der Erklärzeile · „Goblin charges \$0 extra for
inference" · „go live on your own Vercel account — it stays yours".

---

## 3 · Der Anti-Pattern

Aufgenommen in `docs/GOBLIN_ARBEITSMETHODIK.md` — im Anti-Pattern-Katalog und
als Punkt 8 der Selbst-Review-Checkliste.

> **„Wahre Teile, falsches Ganzes" (Kompositions-Fehlschluss).**
> Eine Aussenfläche wird nicht nur String für String auf Wahrheit geprüft,
> sondern gegen **das Modell, das ein Leser aus Reihenfolge, Gewicht und
> typografischer Hierarchie zusammenbaut.** Ein wahrer Satz an der falschen
> Position, in der falschen Auszeichnung, neben einem lauteren Gegensignal, ist
> funktional dasselbe wie ein fehlender Satz.
>
> Prüffrage: **„Welches Ausführungsmodell baut ein technischer Leser aus dieser
> Seite — und in welcher Reihenfolge erfährt er es?"**

Das ist der erste Ehrlichkeitsdefekt im Projekt, den die String-für-String-
Prüfung der Feeling-Invarianten strukturell nicht fangen konnte. Jeder String war
sauber. Der Fehler entstand in Reihenfolge und Gewichtung.

---

## 4 · Der Fix

### 4.1 Neue Sektion direkt unter dem Hero (behebt L-1, L-3, L-6)

Unnummerierter Strip (D-3), `components/landing/sections/Runtime.tsx`. Der
Install-Absatz (`AiLocationNote`) geht darin auf und ist entfernt.

**Headline:** „Your device does nothing. *That's the point.*"

Drei Karten, Design-System-Tokens, schematisch:

| | EN (rendert) | DE (im Source hinterlegt) |
|---|---|---|
| **YOUR DEVICE** | A browser. That is the entire requirement. A phone is enough. | Ein Browser. Mehr braucht es nicht. Ein Handy reicht. |
| **GOBLIN** | Chat, agent, build and publish run on our servers — and so do the AI models. Nothing is downloaded to your device. | Chat, Agent, Build und Veröffentlichen laufen auf unseren Servern — die KI-Modelle ebenso. Auf dein Gerät wird nichts geladen. |
| **YOUR APP** | Goes live on your own Vercel account, with a real URL. The code stays yours. | Geht live auf deinem eigenen Vercel-Account, mit echter URL. Der Code bleibt deiner. |

**Zeile darunter (behebt L-10 an der Wurzel):** „Adding Goblin to your home
screen only adds an icon. It stays a website: no model, no runtime, nothing else
lands on your device."

**Layer-1-Aussage an genau dieser Stelle:** Eyebrow „INCLUDED IN EVERY PLAN —
GOBLIN SWIFT & FORGE" + „Two efficient open-weight models, bundled. Per request
they cost a fraction of a frontier model — that is why the AI can be part of the
plan instead of a second subscription."

*Invarianten-Prüfung:* „efficient open-weight models" ist belegbar (Layer 1 =
offene Gewichte), keine Zahl auf der Seite → keine Drift gegen das CFO-Dashboard,
keine Modellnamen → White-Label-Entscheid unberührt.

**Position vor der Install-Karte**, nicht danach: der Reviewer zitierte „install
Goblin as an app" — die Überschrift der Karte. „Install" ist das Wort der
Plattformen und dort nicht vermeidbar, also wird die Fehllesart vorher entschärft.

### 4.2 Anbieter-Strip verschoben (behebt L-2)

`TrustedBy` ersatzlos aus dem oberen Seitendrittel entfernt und direkt hinter
`Pricing` gesetzt — unmittelbar unter der bestehenden Mono-Zeile „BYOK users
bring their own API keys · Goblin charges \$0 extra for inference". Reines
Verschieben, kein neuer Text.

### 4.3 Hero-Absatz (behebt L-3)

„…Everything runs on our servers; you work in a browser. … **The models run on
our side too** — no keys, no setup, no token counter. Build from any device…"

Dieselbe Korrektur in `metadata.description` (`app/page.tsx`) sowie OG- und
Twitter-Description (`app/layout.tsx`) — dort stand derselbe zweideutige Satz und
ging nach aussen.

### 4.4 „Hardware wall" → Einrichtungs-Wand (behebt L-4)

Titel: **„Laptop lock-in"**. Kernaussage: „Before you write a line, you need a
set-up developer machine. Runtime, toolchain, keys, the lot." Fix-Zeile
mitgezogen: „A browser is the whole requirement" (die alte Fix-Zeile „Build from
any device" antwortete auf die Hardware-Wand, nicht auf die Einrichtungs-Wand).

### 4.5 Footer-Absatz (behebt L-5)

„…subscriptions priced for San Francisco, and tools that assume a set-up
developer machine. Goblin assumes a browser. It is for the rest of the planet."

---

## 5 · Founder-Entscheidungen

| # | Entscheidung | Umgesetzt |
|---|---|---|
| **D-1** | Swift/Forge namentlich ausweisen? | **Nein** — Klasse genannt („efficient open-weight models"), keine Vendor-Namen |
| **D-2** | Anbieter-Strip verschieben oder verkleinern? | **Verschoben** — das Problem war die Position, nicht die Grösse |
| **D-3** | Neue Sektion nummerieren? | **Unnummeriert** — keine Anker-/Label-Verschiebung |
| **D-4** | „Claude Pro locks you out after two hours"? | **Entschärft** → „Frontier subscriptions cut you off mid-session." Kein Name, keine alternde Zahl |
| **D-5** | „Checks & self-heals"? | **Umbenannt** → „Checks its own work"; „self-heal" für Keeper K3 reserviert. Zusatzbefund siehe Anhang A |
| **D-6** | Vor oder nach den Founder-Fenstern? | **Davor** — Copy-Umfang, kein Architektur-Risiko |

---

## Anhang A · Implementierungs-Protokoll

**Branch:** `claude/goblin-landing-messaging-v2-l1ia0k` · **Units:** 2

| Unit | Inhalt | Berührte Dateien |
|---|---|---|
| **U1 — Copy** | 4.3, 4.4, 4.5, D-4, D-5 | `Hero.tsx`, `Problem.tsx`, `AgentFlow.tsx`, `Outro.tsx`, `app/page.tsx`, `app/layout.tsx` |
| **U2 — Struktur** | 4.1, 4.2 | `Runtime.tsx` (neu), `AiLocationNote.tsx` (entfernt), `app/page.tsx`, `styles/landing.css` |

**Zusatzbefund zu D-5 (Frage b — „ist die Selbstkorrektur belegt?").**
Der alte Text lautete „It checks its own work and **fixes what failed** before it
hands anything back" — das behauptet **Erfolg**. Die Schleife ist auf
`MAX_HEAL_CYCLES = 2` begrenzt (`apps/api/src/services/agent/orchestrator.ts:46`)
und Erschöpfung ist ein realer Ausgang, den der Run ehrlich meldet
(`orchestrator.ts:501-509`, `components/code/AgentRunView.tsx:238`). Die Landing
versprach damit ein Ergebnis, dem die eigene Fehlermeldung des Produkts
widerspricht — dieselbe Klasse wie ein False-Green. Neuer Text: „It verifies what
it built, corrects what it can, and tells you plainly when something is still
broken."

**Ein Bug beim Rastern gefunden, nicht im Review.** In der einspaltigen
Mobile-Ansicht behielt der Fluss-Pfeil eine spaltenbreite Layout-Box; die
90°-Rotation warf dadurch eine ~327 px hohe transformierte Box über beide
Nachbarkarten. `justify-self: center` + explizite 22-px-Box hält die Rotation
lokal. Der Element-Screenshot sah unauffällig aus — gefunden wurde es erst durch
Messen der Boxen im Browser.

**Gate (gerastert gegen die laufende Seite, 375 px und 1440 px, hell und dunkel):
20/20 Zusicherungen grün.** Abschnittsreihenfolge · Strip unterhalb Pricing ·
keine Zier-Auszeichnung auf den tragenden Sätzen (`.runtime-card .serif-italic`
= 0) · kein horizontaler Überlauf · jeder zurückgezogene String abwesend
(„The AI is built in", „Hardware wall", „Claude Pro locks you out",
„\$3,000 laptops", „self-heals") · jeder neue String vorhanden.
Zusätzlich: `tsc --noEmit` sauber, `eslint` sauber, 697/697 Unit-Tests,
`next build` sauber.

---

## Anhang B · Korrektur an L-11 (Gesetz 2, erneut)

**Es gibt keine DE-Landing und keinen DE-Key.** `app/page.tsx` rendert
hartkodiertes Englisch, es existiert keine Locale-Route, und der DE·EN-Schalter
in der Navigation setzt ausdrücklich die Sprache **für Anmeldung und App, nicht
für diese Seite** — so dokumentiert in `components/i18n/LangToggle.tsx`. Die
DE-Spalte aus §4 konnte deshalb nicht als gerenderter String landen.

Verfahren nach der Konvention, die `AgentFlow.tsx` bereits gesetzt hat: das vom
Founder verfasste Deutsch liegt im Source neben jedem geänderten String und ist
bereit für den Tag, an dem die Landing lokalisiert wird. Es rendert heute nicht.

Damit ist das Gate „beide Sprachen" **nicht erfüllbar** und wurde in Englisch
gefahren. Die Lokalisierung der Landing bleibt eigene, grössere Arbeit und ist
ein Founder-Entscheid.

---

## Anhang C · Offen (Founder-kontrolliert, kein Code)

1. **L-12** — Anker-Satz in die Standard-WhatsApp-Einladung. Heute fixbar.
2. **Antwort an den Reviewer** — und ihn erneut draufschauen lassen. Er hat den
   Defekt gefunden; er ist der billigste echte Prüfer, den es gibt.
3. **Dieselbe „Wo läuft was"-Prüfung im Pitch**, zusammen mit der offenen
   Schema-A-Angleichung.
4. **Lokalisierung der Landing** (siehe Anhang B) — falls gewünscht.

---

*Ende des Dokuments.*
