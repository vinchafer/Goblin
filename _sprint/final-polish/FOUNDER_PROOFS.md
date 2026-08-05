# Die zwei Beweise — Schritt für Schritt

**Für dich, am Handy.** Zwei Dinge aus Welle E und Welle B wurden nie bewiesen, weil nie
klar war, was genau zu tun ist. Hier steht es wörtlich: was du antippst, was du einfügst,
und woran du siehst, dass es geklappt hat.

**Testaccount, nie dein privater:** `vinc.hafner3@gmail.com` (Reserve: `…4@gmail.com`).

Jeder Beweis ist einzeln. Du kannst E4 heute machen und B3 nächste Woche.

---

# BEWEIS 1 — E4: React-App mit mehreren Dateien, live auf Vercel

**Was bewiesen wird:** Goblin baut eine echte React-App aus mehreren Dateien und stellt
sie auf *deinen* Vercel-Account live — mit einer URL, die wirklich die App ausliefert.

**Dauer:** ~10 Minuten, davon 1–3 Minuten Warten auf den Vercel-Build.

### Vorher: den Vercel-Token holen

1. Auf **vercel.com** mit dem **Testaccount** anmelden (kostenloser Plan reicht).
2. Oben rechts aufs Profilbild → **Account Settings** → links **Tokens**.
3. **Create Token**. Name egal, z. B. `goblin-e4`. Scope: **Full Account**.
   Ablauf: das kürzeste, das dir angeboten wird, reicht.
4. **Create** → der Token wird **genau einmal** angezeigt. Kopieren.

> Der Token ist ein Geheimnis. Nirgends hineinschreiben ausser in Goblin —
> nicht in einen Chat, nicht in ein Dokument, nicht in einen Screenshot.

### Der Beweis

5. In Goblin (Testaccount): **Einstellungen → Konnektoren → Vercel → Verbinden**.
   Token einfügen, speichern.
6. **Es hat geklappt, wenn:** die Zeile "Vercel" jetzt **verbunden** anzeigt, mit dem
   Benutzernamen des Testaccounts darunter. Wenn dort weiter "nicht verbunden" steht:
   Token nochmal erzeugen (Schritt 3) — ein Token wird nur einmal angezeigt und beim
   Kopieren gern abgeschnitten.
7. Ein **neues Projekt** anlegen (Name egal).
8. Im Chat des Projekts **genau diesen Satz** senden — wörtlich, nichts ändern:

```
Baue eine React-App: eine Aufgabenliste mit einer wiederverwendbaren TaskItem-Komponente, State im Parent, und stell sie live.
```

9. Warten. Der Agent zeigt seine Schritte an. Du solltest der Reihe nach sehen:
   ein Projekt-Gerüst wird angelegt → `src/components/TaskItem.tsx` wird geschrieben →
   `src/App.tsx` wird umgebaut → veröffentlichen.
   **Der Vercel-Build dauert 1–3 Minuten.** Das Handy darf dabei zugehen.

### Woran du siehst, dass es PASS ist

10. Am Ende steht eine Karte mit einer Zeile in dieser Form:

```
Live ✓ https://<irgendwas>.vercel.app
```

11. **Diese URL antippen.** Die Aufgabenliste muss sich öffnen und benutzbar sein:
    eine Aufgabe eintippen, hinzufügen, sie erscheint in der Liste.

12. **PASS = beides:** die `Live ✓`-Zeile mit einer echten `*.vercel.app`-URL **und** die
    geöffnete Seite zeigt die funktionierende App.
    Eine URL, die eine leere Seite oder einen Vercel-Fehler zeigt, ist **kein** PASS.

13. Schick mir die URL und einen Screenshot der Karte. Das schliesst E4.

### Wenn es schiefgeht

- **"Kein Vercel-Token"** → Schritt 5 wurde nicht gespeichert. Konnektoren nochmal öffnen.
- **Es bleibt lange bei "veröffentlichen"** → normal bis ~4 Minuten. Danach meldet Goblin
  ehrlich einen Timeout statt Erfolg. Dann: nochmal senden.
- **Die App erscheint, aber ohne Inhalt** → notieren und mir schicken; das wäre ein echter
  Befund und genau das, was der Beweis finden soll.

---

# BEWEIS 2 — B3: App mit Login, und niemand sieht die Aufgaben eines anderen

**Was bewiesen wird:** Goblin baut eine App mit echter Datenbank und echtem Login — und
Konto A kann die Daten von Konto B **nicht** sehen. Das ist die Zeile, die man ohne Beweis
niemals sagen darf.

**Dauer:** ~20 Minuten, weil du zwei Konten in der gebauten App anlegst.

### Vorher: prüfen, ob die Funktion überhaupt an ist

Diese Funktion hat einen Schalter, der auf dem Server gesetzt sein muss. **Prüf das zuerst
— sonst suchst du später an der falschen Stelle.**

1. In Goblin: **Einstellungen → Konnektoren**.
2. Steht dort eine Zeile **Supabase**?
   - **Ja** → weiter mit Schritt 3.
   - **Nein / "nicht verfügbar"** → **STOPP.** Der Schalter ist aus. Was dann fehlt, steht
     unten unter „Wenn Supabase nicht auftaucht". Das ist Server-Einrichtung, kein Fehler
     in der App.

### Der Beweis

3. **Supabase → Verbinden** antippen und den Anmeldevorgang durchlaufen.
   (Falls du noch keinen Supabase-Account hast: auf **supabase.com** mit dem **Testaccount**
   einen kostenlosen anlegen, dann hierher zurück.)
4. **Es hat geklappt, wenn:** die Zeile "Supabase" **verbunden** anzeigt.
5. Ein **neues Projekt** anlegen.
6. Im Chat **genau diesen Satz** senden — wörtlich:

```
Baue eine Aufgabenliste mit Login — jeder sieht nur seine Aufgaben. Stell sie live.
```

7. Warten. Du solltest unterwegs eine Zeile dieser Form sehen:

```
Datenbank angelegt: 1 Tabellen, RLS aktiv (… ms)
```

   „RLS aktiv" ist der Teil, auf den es ankommt — das ist der Schutz, den wir gleich testen.
   Danach wird die App gebaut und veröffentlicht: `Live ✓ <url>`.

### Jetzt der eigentliche Test: zwei Konten

8. Die **`Live ✓`-URL** öffnen. Das ist **die gebaute App**, nicht Goblin — sie hat ihren
   **eigenen** Login. Die beiden Konten hier haben mit deinem Goblin-Konto nichts zu tun.

9. **Konto A anlegen:** in der App auf Registrieren/Sign up, E-Mail und Passwort eingeben.
   Nimm etwas, das du dir merkst, z. B.
   `a+goblinproof@<deine-domain>` / ein Passwort, das du notierst.
   Danach **eine Aufgabe anlegen**, wörtlich:

```
AUFGABE VON A
```

10. **Abmelden.**

11. **Konto B anlegen:** gleiche Seite, **andere** E-Mail, z. B.
    `b+goblinproof@<deine-domain>`. Danach **eine Aufgabe anlegen**, wörtlich:

```
AUFGABE VON B
```

### Woran du siehst, dass es PASS ist

12. Du bist gerade als **B** angemeldet. Auf dem Bildschirm darf **genau eine** Aufgabe
    stehen: **AUFGABE VON B**.
    **„AUFGABE VON A" darf nirgends zu sehen sein.**

13. Abmelden, als **A** anmelden. Jetzt darf **genau** **AUFGABE VON A** dastehen,
    und **AUFGABE VON B** nirgends.

14. **PASS = beide Richtungen.** Nur eine Richtung zu prüfen reicht nicht — genau so
    rutscht ein Leck durch.

15. **Wenn einer der beiden die Aufgabe des anderen sieht: sofort STOPP**, Screenshot,
    mir schicken, und die App **nicht** weiterverwenden. Das wäre ein Datenleck und
    wiegt schwerer als alles andere in dieser Welle.

16. Bei PASS: zwei Screenshots (Ansicht von A, Ansicht von B) plus die URL. Das schliesst B3.

### Wenn Supabase nicht auftaucht (Schritt 2)

Dann fehlt Server-Einrichtung. Das sind Einstellungen, die **nur du** machen kannst —
ich habe hier keine Zugänge:

- Eine Supabase-OAuth-App registrieren und ihre Werte als Railway-Umgebungsvariablen setzen.
- Migration **`0096_fullstack_supabase_backends.sql`** im Supabase-SQL-Editor anwenden.
- Auf Railway **`GOBLIN_FULLSTACK_ENABLED=true`** setzen.

Die genauen Werte und Reihenfolge stehen in `_sprint/wave-b/MERGE_REPORT.md` in der
Founder-Action-Liste. Danach hier bei Schritt 1 weitermachen.

---

## Was ich vorher geprüft habe — und was nicht

Bevor du das machst, habe ich nachgesehen, ob beide Wege im **heutigen Code** noch
verdrahtet sind, damit du nicht in einen kaputten Ablauf läufst:

| Was | Zustand | Wo im Code |
|---|---|---|
| Vercel in den Konnektoren | vorhanden | `ConnectorsPage.tsx` → `VercelConnectorRow` |
| Vercel-Deploy beim Veröffentlichen | vorhanden | `agent/publish.ts` → `deployToVercel` (`vercel-service.ts:172`) |
| Framework-Erkennung + Build-Wahrheitsprüfung | vorhanden | `vercel-service.ts:230` → `detectVercelFramework` |
| Supabase in den Konnektoren | vorhanden | `ConnectorsPage.tsx` → `SupabaseConnectorRow` → `GET /api/supabase/status` |
| Supabase-Route am Server angemeldet | vorhanden | `index.ts:254` → `/api/supabase` |
| `provision_backend` (Datenbank + RLS) | vorhanden, hinter dem Schalter | `agent/tools.ts:263`, `fullstack/config.ts:13` |

**Ehrlich dazu:** das ist eine **Code-Prüfung**, kein Durchlauf. Ich habe in dieser Session
keine Zugänge zu Vercel, Supabase oder der Produktions-Datenbank und habe daher weder
etwas verbunden noch etwas veröffentlicht. Dass die Teile verdrahtet sind, heisst nicht,
dass der Durchlauf gelingt — **genau deshalb sind das deine Beweise.** Wenn unterwegs
etwas nicht so aussieht wie oben beschrieben, ist das ein Befund und kein Bedienfehler:
notieren und mir schicken.

Ob **`GOBLIN_FULLSTACK_ENABLED`** auf Railway gesetzt ist, kann ich von hier aus nicht
sehen. Schritt 2 in Beweis 2 ist genau deshalb die erste Handlung: er beantwortet das in
zwei Sekunden an deinem Handy.
