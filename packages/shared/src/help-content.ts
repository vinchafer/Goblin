// WAVE-J (J1): the canonical Goblin help content — the SINGLE source of truth for
// both the in-app Hilfe section (apps/web) AND the "Goblin Hilfe" support agent's
// grounding (apps/api). It lives in @goblin/shared precisely so those two can never
// drift: one edit updates the docs a user reads and the facts the agent stands on.
//
// CONTENT DISCIPLINE (the wave's law): every claim here is verified against the live
// product code — no aspirational docs. A feature that is flag-gated, "coming soon",
// or support-only is described AS SUCH. Docs that drift are phantom affordances in
// prose; a support agent grounded on a phantom affordance is the worst product lie.
//
// STANDING RULE for the founder's methodology file: feature sprints update the
// relevant help article in the SAME wave. See _sprint/wave-j/REPORT.md.

export type Bilingual = { de: string; en: string };

export interface HelpSection {
  /** Stable in-page anchor (kebab-case) the agent and deep-links can target. */
  anchor: string;
  heading: Bilingual;
  body: Bilingual;
}

export interface HelpArticle {
  /** URL slug: /help/<slug>. Stable — the agent cites articles by title. */
  slug: string;
  /** Small emoji glyph for the Hilfe index (decorative). */
  icon: string;
  title: Bilingual;
  summary: Bilingual;
  sections: HelpSection[];
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'erste-schritte',
    icon: '🚀',
    title: { de: 'Erste Schritte', en: 'Getting started' },
    summary: {
      de: 'Von der Idee zur Nachricht, zusehen, wie Code entsteht, und live stellen.',
      en: 'From idea to message, watch the code appear, and go live.',
    },
    sections: [
      {
        anchor: 'der-weg',
        heading: { de: 'Der Weg in vier Schritten', en: 'The path in four steps' },
        body: {
          de: 'Idee → Nachricht → zusehen → live. Du beschreibst im Chat, was du bauen willst. Goblin schreibt den Code und legt ihn als Entwurf an. Du siehst jede Datei mit einem Status (NEU, GEÄNDERT +n −m, oder IDENTISCH), prüfst sie, sicherst mit „Sichern" und stellst mit „Live stellen" online.',
          en: 'Idea → message → watch → live. You describe what you want in the chat. Goblin writes the code and lands it as a draft. You see each file with a status (NEU/new, GEÄNDERT +n −m/changed, or IDENTISCH/unchanged), review it, save with “Sichern”, and publish with “Live stellen”.',
        },
      },
      {
        anchor: 'entwuerfe-zuerst',
        heading: { de: 'Nichts geht ungefragt live', en: 'Nothing goes live unasked' },
        body: {
          de: 'Was Goblin schreibt, landet zuerst als Entwurf — nie direkt live. Du entscheidest, wann gesichert und wann veröffentlicht wird. So kannst du in Ruhe prüfen, bevor etwas online geht.',
          en: 'Whatever Goblin writes lands as a draft first — never straight to live. You decide when to save and when to publish, so you can review calmly before anything goes online.',
        },
      },
      {
        anchor: 'was-du-siehst',
        heading: { de: 'Was du beim Bauen siehst', en: 'What you see while it builds' },
        body: {
          de: 'Je nach Modell und Projekt arbeitet Goblin entweder in einem einzigen Schritt (der Code erscheint direkt im Chat) oder — auf dafür freigeschalteten Modellen/Konten — als mehrstufiger Agent mit einem Live-Schritt-Verlauf („Liest index.html", „Schreibt script.js · GEÄNDERT +14 −2", „Sichert Entwurf ✓") und einer Abschluss-Karte. Beide Wege enden gleich: geprüfte Entwürfe, die du sicherst und live stellst.',
          en: 'Depending on the model and project, Goblin either works in a single step (code appears in the chat) or — on enabled models/accounts — as a multi-step agent with a live step stream (“reads index.html”, “writes script.js · changed +14 −2”, “saves draft ✓”) and a summary card. Both paths end the same way: reviewed drafts you save and take live.',
        },
      },
    ],
  },
  {
    slug: 'projekte-und-chats',
    icon: '🗂️',
    title: { de: 'Projekte & Chats', en: 'Projects & chats' },
    summary: {
      de: 'Der Unterschied, das Projekt-Gedächtnis und projektweite Anweisungen.',
      en: 'The difference, project memory, and project-wide instructions.',
    },
    sections: [
      {
        anchor: 'unterschied',
        heading: { de: 'Projekt-Chat vs. Einzel-Chat', en: 'Project chat vs. standalone chat' },
        body: {
          de: 'Ein Einzel-Chat ist ein loses Gespräch ohne Projektbindung. Ein Projekt-Chat gehört zu einem Projekt: nur hier hat Goblin Zugriff auf deine Projektdateien, das Projekt-Gedächtnis und — auf freigeschalteten Modellen — die mehrstufigen Werkzeuge. Ein neues Projekt legst du unter „Projekt anlegen" (/dashboard/new) an: Name eingeben, optional beschreiben, was du bauen willst.',
          en: 'A standalone chat is a loose conversation with no project attached. A project chat belongs to a project: only here does Goblin see your project files, the project memory and — on enabled models — the multi-step tools. Create a new project via “Projekt anlegen” (/dashboard/new): give it a name, optionally describe what you want to build.',
        },
      },
      {
        anchor: 'gedaechtnis',
        heading: { de: 'Das Projekt-Gedächtnis', en: 'The project memory' },
        body: {
          de: 'Nach jeder Antwort fasst Goblin im Hintergrund den Stand und die Entscheidungen des Projekts zusammen („Bisheriger Stand & Entscheidungen"). Diese Zusammenfassung wird ersetzt, nicht endlos angehängt, und reist in den nächsten Nachrichten mit — so muss Goblin nicht bei null anfangen. Dieses Hintergrund-Zusammenfassen kostet dich nichts von deinem Einheiten-Kontingent.',
          en: 'After each reply Goblin summarizes the project’s state and decisions in the background (“state & decisions so far”). This summary is replaced, not appended forever, and rides along in later messages so Goblin doesn’t start from zero. This background summarizing does not draw from your unit allowance.',
        },
      },
      {
        anchor: 'anweisungen',
        heading: { de: 'Projektweite Anweisungen', en: 'Project-wide instructions' },
        body: {
          de: 'Jedes Projekt hat ein Feld für dauerhafte Anweisungen (bis zu 2000 Zeichen), z. B. „Nutze immer Deutsch" oder „Halte den Code framework-frei". Diese Anweisungen gelten für jede Nachricht in diesem Projekt, bis du sie änderst.',
          en: 'Every project has a field for standing instructions (up to 2000 characters), e.g. “always answer in German” or “keep the code framework-free”. They apply to every message in that project until you change them.',
        },
      },
    ],
  },
  {
    slug: 'live-stellen',
    icon: '🌍',
    title: { de: 'Live stellen & Vercel verbinden', en: 'Going live & connecting Vercel' },
    summary: {
      de: 'Schritt für Schritt online gehen — der häufigste Stolperpunkt, ehrlich erklärt.',
      en: 'Going online step by step — the most common stuck-point, explained honestly.',
    },
    sections: [
      {
        anchor: 'dein-eigenes-vercel',
        heading: { de: 'Goblin hostet nicht — dein Vercel hostet', en: 'Goblin doesn’t host — your Vercel does' },
        body: {
          de: 'Wichtig zu wissen: Goblin betreibt deine Seite nicht selbst. Deine Live-Seite läuft in deinem eigenen Vercel-Konto. Deshalb verbindest du einmalig Vercel, bevor du live stellen kannst. Ein Vercel-Konto ist kostenlos.',
          en: 'Important: Goblin does not run your site itself. Your live site runs in your own Vercel account. That’s why you connect Vercel once before you can go live. A Vercel account is free.',
        },
      },
      {
        anchor: 'vercel-verbinden',
        heading: { de: 'Vercel verbinden (Token einfügen)', en: 'Connect Vercel (paste a token)' },
        body: {
          de: 'Die Verbindung läuft über einen Token, den du selbst erstellst — kein OAuth-Login. In Vercel: Settings → Tokens → „Create Token" (vercel.com/account/tokens). Diesen Token fügst du in Goblin ein: entweder beim ersten „Live stellen" im Fenster „Noch ein Schritt bis live", oder vorab unter Einstellungen → Konnektoren → Vercel → „Token einfügen". Goblin prüft den Token direkt bei Vercel und speichert ihn verschlüsselt.',
          en: 'Connection is via a token you create yourself — not an OAuth login. In Vercel: Settings → Tokens → “Create Token” (vercel.com/account/tokens). Paste that token into Goblin: either at your first “Live stellen” in the “One step from live” sheet, or beforehand under Settings → Connectors → Vercel → “Add token”. Goblin validates it directly against Vercel and stores it encrypted.',
        },
      },
      {
        anchor: 'live-stellen-knopf',
        heading: { de: 'Der „Live stellen"-Knopf', en: 'The “Live stellen” button' },
        body: {
          de: 'Im Code-Bereich deines Projekts sicherst du zuerst offene Entwürfe und tippst dann „Live stellen" (in älteren Ansichten „Veröffentlichen"). Goblin speichert, deployt zu deinem Vercel und schaltet erst auf „Live", wenn die Prüfung besteht. Pro Stunde sind bis zu 10 Deploys möglich.',
          en: 'In your project’s Code area, save open drafts, then tap “Live stellen” (older views say “Veröffentlichen”). Goblin saves, deploys to your Vercel, and only flips to “Live” once the check passes. Up to 10 deploys per hour.',
        },
      },
      {
        anchor: 'wahrheits-pruefung',
        heading: { de: 'Die Wahrheits-Prüfung', en: 'The truth check' },
        body: {
          de: 'Goblin behauptet „Live" nicht auf gut Glück. Nach dem Deploy prüft es echt: Antwortet die Seite mit HTTP 200 und stimmt sie mit dem gesicherten Stand überein, und laden alle darin verlinkten Dateien (Bilder, Skripte, Styles) ebenfalls? Erst dann heißt es „Live ✓". Scheitert eine Prüfung, nennt Goblin die genaue Ursache (welche Datei/welcher Check) — es wird bis zu ~1 Minute (6 Versuche) erneut geprüft.',
          en: 'Goblin does not claim “Live” on faith. After the deploy it really checks: does the page answer HTTP 200 and match the saved state, and do all files it links to (images, scripts, styles) load too? Only then does it say “Live ✓”. If a check fails, Goblin names the exact cause (which file/check) — it retries for up to ~1 minute (6 attempts).',
        },
      },
    ],
  },
  {
    slug: 'was-goblin-kann',
    icon: '🎯',
    title: { de: 'Was Goblin kann (und noch nicht)', en: 'What Goblin can (and can’t yet) do' },
    summary: {
      de: 'Ehrlich, ohne Marketing: was heute funktioniert und was (noch) fehlt.',
      en: 'Honest, no marketing: what works today and what’s (still) missing.',
    },
    sections: [
      {
        anchor: 'kann',
        heading: { de: 'Was Goblin heute kann', en: 'What Goblin can do today' },
        body: {
          de: 'Per Chat Web-Apps/Seiten bauen und ändern; Code als Entwurf mit Datei-Status (NEU/GEÄNDERT/IDENTISCH) prüfen; Dateien im Explorer verwalten; zu deinem Vercel live stellen (mit Wahrheits-Prüfung); zu GitHub pushen; im Agenten-Modus das Web durchsuchen; eigene Modell-Keys mitbringen (BYOK); vom Handy oder Laptop arbeiten.',
          en: 'Build and edit web apps/pages via chat; review code as drafts with file status (new/changed/unchanged); manage files in the explorer; go live to your Vercel (with the truth check); push to GitHub; search the web in agent mode; bring your own model keys (BYOK); work from phone or laptop.',
        },
      },
      {
        anchor: 'noch-nicht',
        heading: { de: 'Was (noch) nicht geht', en: 'What isn’t there (yet)' },
        body: {
          de: 'Kein globales „Rückgängig" über die ganze Historie (es gibt nur ein kurzes Zurückholen verworfener Entwürfe; echte Historie entsteht über GitHub). Kein Selbstbedienungs-Export deiner Kontodaten per Knopf (Projektdateien kannst du als ZIP herunterladen; einen vollständigen Datenexport erhältst du über den Support). Die Konnektoren Supabase, Stripe und „Eigene Domain" sind als „Bald verfügbar" markiert und noch nicht aktiv. Wenn du etwas suchst, das hier nicht steht, sagt Goblin Hilfe dir ehrlich, dass es das (noch) nicht gibt — statt etwas zu erfinden.',
          en: 'No global “undo” across the whole history (only a brief restore of discarded drafts; real history comes via GitHub). No self-serve one-click export of your account data (you can download project files as a ZIP; a full data export is available through support). The Supabase, Stripe and “Custom domain” connectors are marked “coming soon” and not active yet. If you look for something not listed here, Goblin Hilfe will honestly tell you it doesn’t exist (yet) rather than invent it.',
        },
      },
    ],
  },
  {
    slug: 'trial-und-plaene',
    icon: '💳',
    title: { de: 'Trial & Pläne', en: 'Trial & plans' },
    summary: {
      de: '7 Tage testen, wie Einheiten funktionieren, und was bei Ablauf wirklich passiert.',
      en: '7-day trial, how units work, and what really happens when it ends.',
    },
    sections: [
      {
        anchor: 'trial',
        heading: { de: 'Die 7-Tage-Testphase', en: 'The 7-day trial' },
        body: {
          de: '7 Tage kostenlos, ohne Kreditkarte bei der Anmeldung. Der Zähler startet mit der Anmeldung, nicht mit der ersten Nutzung — deshalb siehst du direkt einen Trial-Hinweis. Das ist normal.',
          en: '7 days free, no credit card at signup. The counter starts at signup, not first use — that’s why you see a trial notice right away. That’s normal.',
        },
      },
      {
        anchor: 'einheiten',
        heading: { de: 'Wie „Einheiten" und „Builds" gemeint sind', en: 'How “units” and “Builds” work' },
        body: {
          de: 'Dein Kontingent zeigt Goblin als greifbare „≈ Builds pro Monat" an — ein Build ist grob ein Bau-/Generierungslauf. Wenn du mit deinem eigenen Modell-Key arbeitest (BYOK), zählt das nicht gegen dein Goblin-Kontingent; du zahlst dann direkt bei deinem Anbieter.',
          en: 'Your allowance is shown as a tangible “≈ Builds per month” — a Build is roughly one build/generation run. When you work with your own model key (BYOK), that does not count against your Goblin allowance; you pay your provider directly.',
        },
      },
      {
        anchor: 'plaene',
        heading: { de: 'Die Pläne', en: 'The plans' },
        body: {
          de: 'Es gibt drei bezahlte Pläne — Build, Pro und Power — mit steigendem monatlichen Kontingent (mehr „Builds/Monat"). Die aktuellen Preise (regional angepasst) stehen live auf der Preisseite (/pricing); genau deshalb nennt Goblin Hilfe dir keine feste Zahl aus dem Gedächtnis. Alle Pläne enthalten unbegrenzte Projekte, BYOK für alle Anbieter und das Bauen von jedem Gerät.',
          en: 'There are three paid plans — Build, Pro and Power — with rising monthly allowances (more “Builds/month”). Current prices (region-adjusted) are live on the pricing page (/pricing); that’s exactly why Goblin Hilfe won’t quote a fixed number from memory. All plans include unlimited projects, BYOK for all providers, and building from any device.',
        },
      },
      {
        anchor: 'ablauf',
        heading: { de: 'Was bei Ablauf WIRKLICH passiert', en: 'What REALLY happens when it ends' },
        body: {
          de: 'Nach der Testphase siehst du einen Hinweis und die kostenpflichtigen Cloud-Funktionen sind gesperrt, bis du einen Plan wählst. Deine Projekte und dein Code bleiben erhalten — nichts wird gelöscht. Kündigen kannst du jederzeit unter Einstellungen → Abrechnung (Stripe-Portal); der Zugang läuft bis zum Periodenende und verlängert sich dann nicht.',
          en: 'After the trial you see a notice and the paid cloud features are locked until you choose a plan. Your projects and code stay — nothing is deleted. You can cancel anytime under Settings → Billing (Stripe portal); access runs to the end of the period and then does not renew.',
        },
      },
    ],
  },
  {
    slug: 'dateien-und-arbeitsbereich',
    icon: '📁',
    title: { de: 'Dateien & Arbeitsbereich', en: 'Files & workspace' },
    summary: {
      de: 'Dateien sehen und bearbeiten, Entwürfe, Papierkorb und Download.',
      en: 'View and edit files, drafts, trash, and download.',
    },
    sections: [
      {
        anchor: 'explorer',
        heading: { de: 'Der Datei-Explorer', en: 'The file explorer' },
        body: {
          de: 'Jedes Projekt hat einen Datei-Explorer mit Baum, Editor, Leseansicht und Diff-Ansicht. Du kannst Dateien anlegen, hochladen, umbenennen, verschieben und Ordner erstellen. Änderungen werden als Diff angezeigt (+ hinzugefügt / − entfernt).',
          en: 'Every project has a file explorer with a tree, editor, reader and diff view. You can create, upload, rename and move files and create folders. Changes are shown as a diff (+ added / − removed).',
        },
      },
      {
        anchor: 'entwuerfe-sichern',
        heading: { de: 'Entwurf → gesichert → live', en: 'Draft → saved → live' },
        body: {
          de: 'Code, den Goblin schreibt, ist zunächst ein Entwurf. „Sichern" macht daraus die echte gespeicherte Datei (veröffentlicht aber noch nichts). Erst „Live stellen" bringt den gesicherten Stand online. Diese drei Stufen bleiben immer getrennt.',
          en: 'Code Goblin writes is a draft first. “Sichern”/Save turns it into the real stored file (still not published). Only “Live stellen”/Publish takes the saved state online. These three stages always stay separate.',
        },
      },
      {
        anchor: 'papierkorb-download',
        heading: { de: 'Papierkorb & Download', en: 'Trash & download' },
        body: {
          de: 'Gelöschte Dateien landen im Papierkorb (.trash/) und werden weder mitgebaut noch mit exportiert, bis du den Papierkorb leerst. Ein ganzes Projekt kannst du als ZIP herunterladen (Projekt → Herunterladen); der Papierkorb ist dabei ausgeschlossen.',
          en: 'Deleted files go to trash (.trash/) and are excluded from builds and exports until you empty the trash. You can download a whole project as a ZIP (Project → Download); trash is excluded.',
        },
      },
      {
        anchor: 'anhaenge',
        heading: { de: 'Anhänge im Chat', en: 'Chat attachments' },
        body: {
          de: 'Du kannst Text-Dateien und PDFs an eine Nachricht anhängen (PDF bis 10 MB); der extrahierte Text fließt in diese eine Nachricht ein. Es gibt ein Zeichenbudget pro Nachricht — ist der Anhang zu groß, sagt Goblin das ehrlich vor dem Senden, statt still zu kürzen.',
          en: 'You can attach text files and PDFs to a message (PDF up to 10 MB); the extracted text flows into that one message. There is a per-message character budget — if an attachment is too big, Goblin says so honestly before sending rather than silently truncating.',
        },
      },
    ],
  },
  {
    slug: 'websuche-und-konnektoren',
    icon: '🔌',
    title: { de: 'Websuche & Konnektoren', en: 'Web search & connectors' },
    summary: {
      de: 'GitHub, Vercel, Websuche und eigene Modell-Keys — was heute verbunden werden kann.',
      en: 'GitHub, Vercel, web search and your own model keys — what connects today.',
    },
    sections: [
      {
        anchor: 'github',
        heading: { de: 'GitHub', en: 'GitHub' },
        body: {
          de: 'Unter Einstellungen → Konnektoren → GitHub verbindest du GitHub mit einem Klick (OAuth). Danach kannst du dein Projekt pushen: Der erste Push legt das Repo an, spätere Pushes committen in dasselbe Repo. So entsteht auch deine echte Versionshistorie.',
          en: 'Under Settings → Connectors → GitHub you connect GitHub in one click (OAuth). Then you can push your project: the first push creates the repo, later pushes commit to the same repo. This is also how you get real version history.',
        },
      },
      {
        anchor: 'vercel',
        heading: { de: 'Vercel', en: 'Vercel' },
        body: {
          de: 'Vercel verbindest du per selbst erstelltem Token (kein OAuth) — die Details stehen in „Live stellen & Vercel verbinden". Deine Live-Seite läuft in deinem eigenen Vercel-Konto.',
          en: 'You connect Vercel with a token you create yourself (not OAuth) — details are in “Going live & connecting Vercel”. Your live site runs in your own Vercel account.',
        },
      },
      {
        anchor: 'websuche',
        heading: { de: 'Websuche', en: 'Web search' },
        body: {
          de: 'Im Agenten-Modus kann Goblin das Web durchsuchen (über Brave) und nennt dabei die Quelle als „Quelle: <url>". Es gibt einen Standard-Tageslimit; du kannst optional deinen eigenen (kostenlosen) Brave-Key hinzufügen, um ohne dieses Limit zu suchen. Im normalen Chat (ohne Agent) gibt es keine Websuche.',
          en: 'In agent mode Goblin can search the web (via Brave) and cites the source as “Quelle: <url>”. There is a default daily limit; you can optionally add your own (free) Brave key to search without that limit. Plain chat (no agent) has no web search.',
        },
      },
      {
        anchor: 'byok',
        heading: { de: 'Eigene Modell-Keys (BYOK)', en: 'Your own model keys (BYOK)' },
        body: {
          de: 'Unter Einstellungen → Modelle → „Meine Keys" kannst du Schlüssel von Anthropic, OpenAI, Google, Groq, Mistral, xAI, DeepSeek, Together, Fireworks, OpenRouter (u. a.) hinterlegen. Goblin leitet Anfragen an deinen Anbieter weiter, du zahlst dort direkt, Goblin verlangt 0 $ Aufschlag. Ohne eigenen Key kannst du Goblins gebündelte Modelle (Swift/Forge) und eine kostenlose Modell-Ebene nutzen. Keys werden verschlüsselt gespeichert.',
          en: 'Under Settings → Models → “My keys” you can add keys from Anthropic, OpenAI, Google, Groq, Mistral, xAI, DeepSeek, Together, Fireworks, OpenRouter (and more). Goblin routes requests to your provider, you pay there directly, Goblin adds $0. Without a key you can use Goblin’s bundled models (Swift/Forge) and a free model tier. Keys are stored encrypted.',
        },
      },
      {
        anchor: 'bald',
        heading: { de: 'Bald verfügbar', en: 'Coming soon' },
        body: {
          de: 'Supabase, Stripe und „Eigene Domain" sind sichtbar, aber noch nicht aktiv („Bald verfügbar"). Bitte verlasse dich noch nicht darauf.',
          en: 'Supabase, Stripe and “Custom domain” are visible but not active yet (“coming soon”). Please don’t rely on them yet.',
        },
      },
    ],
  },
  {
    slug: 'wenn-etwas-schiefgeht',
    icon: '🛠️',
    title: { de: 'Wenn etwas schiefgeht', en: 'When something goes wrong' },
    summary: {
      de: 'Deploy-Fehler lesen, einen Lauf stoppen und Änderungen zurücknehmen.',
      en: 'Read deploy errors, stop a run, and take changes back.',
    },
    sections: [
      {
        anchor: 'deploy-fehler',
        heading: { de: 'Einen Deploy-Fehler lesen', en: 'Reading a deploy error' },
        body: {
          de: 'Scheitert das Live-Stellen, zeigt Goblin den genauen Grund inline auf Deutsch — es rät nicht. Häufige Ursachen: kein oder abgelehnter Vercel-Token (dann unter Einstellungen aktualisieren), das Vercel-Limit erreicht, oder die Wahrheits-Prüfung scheitert, weil die Seite nicht erreichbar ist oder eine verlinkte Datei (Bild/Skript/Style) fehlt. Der genannte Datei-/Check-Name sagt dir, wo du ansetzt.',
          en: 'If going live fails, Goblin shows the exact reason inline in German — it does not guess. Common causes: no or rejected Vercel token (update it under Settings), the Vercel limit reached, or the truth check failing because the page is unreachable or a linked file (image/script/style) is missing. The named file/check tells you where to look.',
        },
      },
      {
        anchor: 'lauf-stoppen',
        heading: { de: 'Einen Lauf stoppen', en: 'Stopping a run' },
        body: {
          de: 'Einen laufenden Agenten-Lauf kannst du abbrechen. Goblin stoppt dann und sichert den Teilstand („Gestoppt — Teilstand gesichert") — deine bisherigen Entwürfe gehen nicht verloren.',
          en: 'You can cancel a running agent run. Goblin then stops and keeps the partial state (“Stopped — partial state kept”) — your drafts so far are not lost.',
        },
      },
      {
        anchor: 'rueckgaengig',
        heading: { de: 'Änderungen zurücknehmen', en: 'Taking changes back' },
        body: {
          de: 'Weil Goblin zuerst Entwürfe schreibt, kannst du einen Entwurf einfach verwerfen, bevor du sicherst — verwirfst du versehentlich, gibt es ein kurzes „Zurückholen". Ein globales „Rückgängig" über die ganze Historie gibt es nicht; für echte Versionsstände nutze den GitHub-Push (dort liegt jede Version als Commit).',
          en: 'Because Goblin writes drafts first, you can simply discard a draft before saving — if you discard by accident, there is a brief “restore”. There is no global “undo” across the whole history; for real version history use the GitHub push (every version is a commit there).',
        },
      },
    ],
  },
  {
    slug: 'konto-und-daten',
    icon: '🔒',
    title: { de: 'Konto & Daten', en: 'Account & data' },
    summary: {
      de: 'Löschung, Export und die Datenschutz-Kurzfassung.',
      en: 'Deletion, export, and the privacy short version.',
    },
    sections: [
      {
        anchor: 'loeschung',
        heading: { de: 'Konto löschen (mit Bedenkzeit)', en: 'Deleting your account (with a grace period)' },
        body: {
          de: 'Du kannst dein Konto löschen; zur Bestätigung tippst du „DELETE". Danach beginnt eine Bedenkzeit von 10 Tagen: In dieser Zeit ist der Zugang gesperrt, aber die Löschung ist noch umkehrbar — über den Link „Löschung abbrechen" aus der E-Mail. Erst nach den 10 Tagen wird endgültig und unwiderruflich gelöscht (und erst, wenn kein laufendes Abo mehr abrechnen könnte).',
          en: 'You can delete your account; to confirm you type “DELETE”. Then a 10-day grace period begins: access is locked but deletion is still reversible — via the “cancel deletion” link in the email. Only after the 10 days is everything permanently and irreversibly deleted (and only once no active subscription could still bill).',
        },
      },
      {
        anchor: 'export',
        heading: { de: 'Deine Daten exportieren', en: 'Exporting your data' },
        body: {
          de: 'Deine Projektdateien kannst du jederzeit selbst als ZIP herunterladen. Einen vollständigen Export deiner personenbezogenen Daten gibt es (noch) nicht als Knopf — den bekommst du auf Anfrage über den Support.',
          en: 'You can download your project files as a ZIP yourself anytime. A full export of your personal data is not (yet) a button — you get it on request through support.',
        },
      },
      {
        anchor: 'datenschutz-kurz',
        heading: { de: 'Datenschutz in Kürze', en: 'Privacy in brief' },
        body: {
          de: 'Deine Dateien und dein Code werden verschlüsselt in der EU gespeichert und bei der Kontolöschung entfernt. Deine Live-Seite läuft bei Vercel (ein Unterauftragsverarbeiter). Mit eigenem Modell-Key gehen deine Eingaben direkt zu deinem Anbieter. Goblin setzt nur notwendige Cookies und kein Drittanbieter-Tracking. Intern erfassen wir Nutzungsereignisse — welche Funktion wann, nie Inhalte — um zu sehen, wo Leute hängenbleiben; diese Ereignisse werden bei der Kontolöschung mitgelöscht.',
          en: 'Your files and code are stored encrypted in the EU and removed when you delete your account. Your live site runs on Vercel (a subprocessor). With your own model key, your inputs go directly to your provider. Goblin sets only necessary cookies and no third-party tracking. Internally we record usage events — which function, when, never content — to see where people get stuck; these events are deleted along with your account.',
        },
      },
    ],
  },
];

/** Look up one article by slug. */
export function helpArticleBySlug(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

/** The article titles the support agent may cite (both languages). */
export function helpArticleTitles(): Array<{ slug: string; de: string; en: string }> {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug, de: a.title.de, en: a.title.en }));
}

/**
 * Flatten the whole help corpus into a plain-text knowledge base for the support
 * agent's system prompt. Bounded and cheap (the corpus is small), so no vector
 * infra is needed — the agent gets the full ground truth every turn. Each section
 * is tagged with its article title + anchor so the agent can cite precisely.
 * `lang` picks the primary language body; the other is appended compactly so the
 * agent can still answer if the user switches language mid-conversation.
 */
export function renderHelpForAgent(lang: 'de' | 'en' = 'de'): string {
  const other = lang === 'de' ? 'en' : 'de';
  const out: string[] = [];
  for (const a of HELP_ARTICLES) {
    out.push(`\n### ${a.title[lang]} (${a.title[other]}) — slug: ${a.slug}`);
    for (const s of a.sections) {
      out.push(`- [${a.title[lang]} #${s.anchor}] ${s.heading[lang]}: ${s.body[lang]}`);
    }
  }
  return out.join('\n');
}
