# Nutzungsrichtlinie / Acceptable-Use-Policy (AUP)

**Stand: 2026-07-28 · Version 1.1 · Haus-Register (klar, menschlich).**

> **Was sich in 1.1 geändert hat:** Der strukturelle Satz „Goblin hostet Nutzer-Inhalte NIE
> öffentlich" ist gestrichen — ab AKT 2 · Phase 2 kann Goblin Apps selbst auf
> `{name}.justgoblin.app` veröffentlichen (eingeschränkte Beta). Neu: die Zwei-Wege-
> Verantwortlichkeit, die Grenzen 8–12 (Krypto-Drainer · Spam/SEO-Linkfarmen ·
> Urheberrecht · Ressourcen-Missbrauch · Datenverarbeitung ohne Berechtigung), die
> ausdrückliche CSAM-Null-Toleranz, ein ehrlicher Abschnitt „Was Goblin prüft — und was
> nicht", der Meldeweg `abuse@justgoblin.com` und das Urheberrechts-Beschwerdeverfahren
> (Schweiz, kein DMCA-Agent).

> ⚠️ **Von KI verfasst, nicht anwaltlich geprüft — vor Skalierung juristisch reviewen lassen.**
> Dieser Text ist die verbindliche Produkt-Richtlinie, aber KEIN anwaltlich geprüftes
> Rechtsdokument. Bevor Goblin über den heutigen Rahmen hinaus wächst, muss ein Anwalt
> diese Richtlinie (und die AGB) prüfen. Das ist eine offene Gründer-Aufgabe, kein
> versteckter Mangel.

Diese Richtlinie ist die **kanonische Quelle** für:
- die öffentliche Seite `/acceptable-use` (`apps/web/app/(legal)/acceptable-use/page.tsx`),
- die Wortwahl der Veröffentlichungs-Sperren (K3, `publish-scan`),
- das Missbrauchs-Runbook (`docs/ABUSE_RESPONSE.md`).

Ändert sich hier etwas Inhaltliches, müssen diese drei Stellen nachgezogen werden.

---

## Goblins Missbrauchsfläche — zwei Wege, zwei Verantwortlichkeiten

> **Geändert 2026-07-28 (Version 1.1).** Bis Version 1.0 stand hier: „Goblin hostet
> Nutzer-Inhalte NIE öffentlich." Das war für den damaligen Stand richtig und ist es ab
> AKT 2 · Phase 2 **nicht mehr**. Der Satz ist ersatzlos gestrichen, weil eine falsche
> Richtlinie schlimmer ist als eine fehlende. Vorgemerkt in
> `docs/OPS_SPIKE_0_DECISION_TABLE.md` (§116/§351/§486), aufgelöst in
> `docs/HOSTING_CLAIMS_AUDIT.md`.

Es gibt jetzt **zwei** Veröffentlichungswege, und sie haben unterschiedliche
Verantwortlichkeiten:

**Weg A — eigenes Vercel-Konto des Nutzers (Standard, für alle Konten).**
Goblin pusht den Code in das Konto des Nutzers. Die Hosting-Ebene — und damit die
Trust-&-Safety-Maschinerie für den öffentlich sichtbaren Inhalt — gehört dem Nutzer und
**Vercel**. Goblin kann das Konto sperren, aber das Deployment des Nutzers nicht löschen.

**Weg B — von Goblin gehostet auf `{name}.justgoblin.app` (ab Phase 2, eingeschränkte
Beta, nur freigeschaltete Konten).**
Hier ist **Goblin der Hoster**. Der Inhalt liegt auf Goblins Infrastruktur, wird unter
Goblins Domain ausgeliefert, und Goblin kann ihn abschalten. Damit trägt Goblin auf diesem
Weg die Hoster-Verantwortung, die auf Weg A bei Vercel liegt — inklusive Meldeweg,
Sperrmechanismus und Beschwerdeverfahren (siehe `docs/ABUSE_RESPONSE.md`).

Der Projektspeicher (B2) ist auf beiden Wegen privat.

Goblins Missbrauchsfläche ist damit:

1. **was der Agent zu BAUEN bereit ist** (Generierungs-Ebene, K2),
2. **was die Publish-Pipeline AUSLIEFERT** (Pipeline-Ebene, K3),
3. **was Goblin selbst öffentlich HOSTET** (Weg B — neu ab Phase 2),
4. **Plattform-Ressourcen-Missbrauch** (Raten/Kosten — Wave-D-Gebiet).

Punkt 3 ist neu und der Grund für diese Revision. Auf Weg B gibt es keinen dritten
Anbieter mehr, hinter dem Goblin sich einordnen könnte.

---

## DE — Nutzungsrichtlinie

Goblin hilft dir, echte Software zu bauen und live zu stellen. Damit das für alle sicher
bleibt, gibt es ein paar klare Grenzen. Was du **nicht** mit Goblin bauen oder
veröffentlichen darfst:

1. **Phishing, Credential-Harvesting & Marken-Imitation.**
   Keine Seiten, die Zugangsdaten (Passwörter, Codes, Tokens) abgreifen — auch nicht,
   indem sie den Login einer bekannten Marke (Bank, Bezahldienst, E-Mail-Anbieter, Behörde)
   nachbauen. Ein Login für **deine eigene** App ist selbstverständlich erlaubt; das
   Nachbauen fremder Marken, um Nutzer zu täuschen, nicht.

2. **Malware & Miner.**
   Keine Schadsoftware, keine heimlichen Krypto-Miner, kein Code, der ohne Wissen des
   Besuchers dessen Gerät oder Rechenleistung nutzt.

3. **Täuschung & Betrug.**
   Keine Fake-Shops, keine erfundenen Gewinnspiele, keine Vorschussbetrug-Seiten, keine
   Inhalte, die Menschen gezielt in die Irre führen, um sie zu schädigen.

4. **Illegale Inhalte (Schweizer Recht).**
   Nichts, was nach geltendem Recht — insbesondere Schweizer Recht — verboten ist: keine
   Anleitungen zu schweren Straftaten, keine rechtswidrigen Waren, keine verbotenen
   Darstellungen von Gewalt, keine rassendiskriminierenden Inhalte (Art. 261bis StGB).

   **Null-Toleranz: Darstellungen sexuellen Missbrauchs Minderjähriger (CSAM).**
   Das ist die eine Grenze ohne Ermessen, ohne Vorwarnung und ohne Gespräch: sofortige
   Entfernung, sofortige Konto-Kündigung, Beweissicherung und Meldung an die zuständigen
   Behörden. Keine Frist, keine Kulanz, kein Beschwerde-Aufschub.

5. **Erfassung von Zahlungsdaten außerhalb zertifizierter Anbieter.**
   Bezahlung ja — aber über zertifizierte Anbieter: **Stripe-Links, PayPal-Buttons** und
   Vergleichbares sind erlaubt. **Eigene Kartenformulare**, die Kreditkartennummer, CVV oder
   IBAN direkt einsammeln, sind es nicht. (Das schützt dich und deine Besucher — und dich vor
   PCI-Pflichten, die du nicht tragen willst.)

6. **Belästigung & Hass.**
   Keine Seiten, die gezielt Einzelne belästigen, bloßstellen oder zu Hass und Gewalt gegen
   Gruppen aufrufen.

7. **Umgehung der Schutzmechanismen.**
   Kein Versuch, die hier genannten Grenzen, die Prüfungen beim Veröffentlichen oder die
   technischen Limits der Plattform zu umgehen, auszutricksen oder zu verschleiern.

8. **Krypto-Drainer & Wallet-Betrug.**
   Keine Seiten, die eine Wallet verbinden, um sie leerzuräumen; keine gefälschten
   Airdrops, Mint-Seiten, „Seed-Phrase-Wiederherstellung" oder Token-Freigaben, die dem
   Besucher etwas anderes vorspielen als das, was sie tatsächlich signieren lassen.

9. **Spam, Massenmail & SEO-Linkfarmen.**
   Kein Versand unerbetener Massen-E-Mails, keine Seiten zum Sammeln von Adressen für
   solchen Versand, keine Doorway-Pages, Linkfarmen oder automatisch erzeugten
   Textmassen, die nur Suchmaschinen manipulieren sollen.

10. **Urheberrechtsverletzungen.**
    Keine Inhalte, an denen dir die Rechte fehlen — keine raubkopierten Medien, keine
    Software-Cracks, keine Weiterverbreitung fremder Werke ohne Erlaubnis. Beschwerdeweg:
    siehe „Urheberrechtsbeschwerde" unten.

11. **Ressourcen-Missbrauch.**
    Kein Mining, kein Betrieb der App als offener Proxy, VPN-Ausgang oder Relay, keine
    Traffic-Verstärkung (Amplification/Reflection), keine Lastgeneratoren gegen Dritte und
    kein absichtliches Ausreizen der Plattform-Limits (Speicher, Requests, Bandbreite) —
    weder direkt noch verteilt über mehrere Konten.

12. **Verarbeitung von Daten ohne Berechtigung.**
    Nutze deine gehostete App nicht, um personenbezogene oder vertrauliche Daten zu
    verarbeiten, für die dir die Rechtsgrundlage oder die Erlaubnis fehlt — etwa
    abgezogene Datenbanken, gescrapte Personendaten oder Daten deines Arbeitgebers ohne
    dessen Zustimmung. Für die Rechtmäßigkeit deiner Verarbeitung bist **du** der
    Verantwortliche, nicht Goblin.

### Was Goblin prüft — und was nicht

Ehrlich, damit du dich nicht auf etwas verlässt, das es nicht gibt:

- Goblin führt **vor dem Veröffentlichen automatische Prüfungen** durch: eine feste,
  deterministische Regelliste über die HTML-/JS-Dateien (`publish-scan.ts` /
  `scan-rules.ts`), ohne externen Dienst. Klare Phishing- und Malware-Treffer
  **blockieren** die Veröffentlichung; schwächere Signale werden nur **protokolliert** und
  blockieren nicht.
- Diese Prüfung ist bewusst eng: Marken werden nur erkannt, wenn sie in einer bekannten
  Liste stehen und in Titel/Überschrift auftauchen. Verschleierter Code allein blockiert
  nicht.
- Goblin **prüft nicht jede App inhaltlich** und liest sie nicht durch. Es gibt keine
  manuelle Vorabkontrolle und keine Rund-um-die-Uhr-Überwachung.
- Goblin **reagiert auf Meldungen** (siehe „Missbrauch melden").

Die Verantwortung für deine App bleibt bei **dir**. Dass eine App veröffentlicht wurde,
ist keine Freigabe, keine Prüfung und keine Zusicherung durch Goblin.

### Missbrauch melden

Eine von Goblin gehostete App (`*.justgoblin.app`), die gegen diese Richtlinie verstößt,
meldest du an **abuse@justgoblin.com** — mit URL und kurzer Beschreibung. Wir zielen
darauf ab, glaubwürdige Meldungen **innerhalb von 24 Stunden** zu sichten. Das ist ein
Ziel, keine Zusicherung: Goblin wird von einer Einzelperson betrieben.

Liegt die App auf dem **eigenen Vercel-Konto** des Nutzers (Weg A), ist zusätzlich Vercel
der richtige Adressat für eine Abschaltung: <https://vercel.com/abuse>.

### Urheberrechtsbeschwerde

Goblin hat den Sitz in der **Schweiz**; es gilt Schweizer Recht. Goblin unterhält
**keinen DMCA-Agenten** und gibt keine DMCA-Verfahrensgarantien ab — solche Angaben wären
falsch. Beschwerden zu von Goblin gehosteten Inhalten gehen formlos an
**abuse@justgoblin.com** und sollten enthalten: die genaue URL, die Bezeichnung des
geschützten Werks, den Nachweis deiner Berechtigung, deine Kontaktdaten und eine Erklärung,
dass deine Angaben zutreffen. Ist die Beschwerde plausibel, informieren wir den Nutzer und
entfernen oder sperren den Inhalt; der Nutzer kann widersprechen (siehe
`docs/ABUSE_RESPONSE.md`).

### Was passiert, wenn diese Grenzen verletzt werden

Je nach Schwere und Absicht:
- **Projekt-Sperre** — das betroffene Projekt kann nicht (weiter) veröffentlicht werden.
- **Abschaltung der gehosteten App** — auf Weg B (`*.justgoblin.app`) kann Goblin die App
  selbst offline nehmen, weil Goblin dort der Hoster ist. Soweit praktikabel mit
  Benachrichtigung; bei CSAM oder aktivem Phishing sofort und ohne Vorankündigung.
- **Konto-Kündigung** — bei schweren oder wiederholten Verstößen.
- **Meldung an den Hosting-Provider** — nur relevant auf Weg A: liegt die Seite im eigenen
  Vercel-Konto des Nutzers, kann nur **Vercel** sie abschalten (<https://vercel.com/abuse>).
- **Meldung an Behörden**, wo gesetzlich geboten.

Wir handeln mit Augenmaß: Bei einem ehrlichen Missverständnis suchen wir zuerst das Gespräch.
Bei klarem Missbrauch handeln wir konsequent.

### Wenn eine Sperre ein Fehler ist

Unsere automatischen Prüfungen sind bewusst vorsichtig, aber nicht unfehlbar. Wenn deine
legitime App fälschlich blockiert wurde: **nutze den Feedback-Knopf** — ein Mensch schaut es
sich an. Wir wollen ehrliche Bauer:innen nicht ausbremsen.

---

## EN — Acceptable-Use Policy

Goblin helps you build and ship real software. To keep that safe for everyone, a few clear
limits apply. You may **not** build or publish with Goblin:

1. **Phishing, credential harvesting & brand impersonation.**
   No pages that capture credentials (passwords, codes, tokens) — including by imitating the
   login of a known brand (bank, payment provider, email service, government). A login for
   **your own** app is of course fine; cloning someone else's brand to deceive users is not.

2. **Malware & miners.**
   No malicious software, no covert crypto-miners, no code that uses a visitor's device or
   compute without their knowledge.

3. **Deception & fraud.**
   No fake shops, fabricated giveaways, advance-fee scams, or content designed to mislead
   people in order to harm them.

4. **Illegal content (Swiss law).**
   Nothing prohibited by applicable law — Swiss law in particular: no instructions for
   serious crimes, no unlawful goods, no prohibited depictions of violence, no racially
   discriminatory content (Art. 261bis Swiss Criminal Code).

   **Zero tolerance: child sexual abuse material (CSAM).**
   This is the one limit with no discretion, no warning, and no conversation: immediate
   removal, immediate account termination, evidence preservation, and a report to the
   competent authorities. No grace period, no leniency, no appeal-based delay.

5. **Collecting payment data outside certified providers.**
   Payments yes — via certified providers: **Stripe links, PayPal buttons** and the like are
   allowed. **Your own card forms** that directly collect card number, CVV, or IBAN are not.
   (This protects you and your visitors — and spares you PCI obligations you don't want.)

6. **Harassment & hate.**
   No pages that target individuals for harassment or exposure, or that incite hatred or
   violence against groups.

7. **Circumventing safety mechanisms.**
   No attempt to bypass, trick, or obscure the limits above, the publish-time checks, or the
   platform's technical limits.

8. **Crypto drainers & wallet scams.**
   No pages that connect a wallet in order to empty it; no fake airdrops, mint pages,
   "seed-phrase recovery" flows, or token approvals that show the visitor something other
   than what they are actually being made to sign.

9. **Spam, bulk mail & SEO link farms.**
   No sending of unsolicited bulk email, no pages that harvest addresses for it, no doorway
   pages, link farms, or machine-generated bulk text whose only purpose is to manipulate
   search engines.

10. **Copyright infringement.**
    No content you don't hold the rights to — no pirated media, no software cracks, no
    redistribution of someone else's work without permission. Complaint route: see
    "Copyright complaints" below.

11. **Resource abuse.**
    No mining, no running your app as an open proxy, VPN exit, or relay, no traffic
    amplification or reflection, no load generators aimed at third parties, and no
    deliberate exhaustion of platform limits (storage, requests, bandwidth) — neither
    directly nor spread across multiple accounts.

12. **Processing data you have no right to process.**
    Don't use your hosted app to process personal or confidential data you have no legal
    basis or permission for — for example dumped databases, scraped personal data, or your
    employer's data without their consent. For the lawfulness of your processing **you**
    are the controller, not Goblin.

### What Goblin checks — and what it does not

Stated honestly, so you don't rely on something that doesn't exist:

- Goblin runs **automated checks before publishing**: a fixed, deterministic rule list over
  the HTML/JS files (`publish-scan.ts` / `scan-rules.ts`), with no external service.
  Clear phishing and malware hits **block** the publish; weaker signals are only **logged**
  and do not block.
- Those checks are deliberately narrow: brands are recognised only if they appear in a
  known list and show up in a title or heading. Obfuscated code alone does not block.
- Goblin does **not review the content of every app** and does not read them. There is no
  manual pre-approval and no round-the-clock monitoring.
- Goblin **does react to reports** (see "Reporting abuse").

Responsibility for your app stays with **you**. The fact that an app was published is not
an approval, not a review, and not a warranty by Goblin.

### Reporting abuse

To report a Goblin-hosted app (`*.justgoblin.app`) that violates this policy, write to
**abuse@justgoblin.com** with the URL and a short description. We aim to triage credible
reports **within 24 hours**. That is a target, not a warranty: Goblin is run by one person.

If the app sits in the user's **own Vercel account** (path A), Vercel is additionally the
right addressee for a takedown: <https://vercel.com/abuse>.

### Copyright complaints

Goblin is based in **Switzerland** and Swiss law applies. Goblin does **not** maintain a
DMCA agent and makes no DMCA procedural guarantees — claiming otherwise would be false.
Complaints about Goblin-hosted content go informally to **abuse@justgoblin.com** and should
include: the exact URL, identification of the protected work, evidence of your authority,
your contact details, and a statement that your information is accurate. Where a complaint
is plausible we notify the user and remove or suspend the content; the user may object
(see `docs/ABUSE_RESPONSE.md`).

### Consequences

Depending on severity and intent:
- **Project block** — the project cannot (continue to) be published.
- **Takedown of the hosted app** — on path B (`*.justgoblin.app`) Goblin can take the app
  offline itself, because Goblin is the host there. With notice where practicable;
  immediately and without prior notice for CSAM or active phishing.
- **Account termination** — for severe or repeated violations.
- **Report to the hosting provider** — only relevant on path A: if the site lives in the
  user's own Vercel account, only **Vercel** can take it down (<https://vercel.com/abuse>).
- **Report to authorities**, where legally required.

We act with proportion: for an honest misunderstanding we talk first; for clear abuse we act
decisively.

### If a block is a mistake

Our automated checks are deliberately cautious but not infallible. If your legitimate app was
wrongly blocked: **use the feedback button** — a human will look at it. We don't want to slow
down honest builders.
