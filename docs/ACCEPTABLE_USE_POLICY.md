# Nutzungsrichtlinie / Acceptable-Use-Policy (AUP)

**Stand: 2026-07-11 · Version 1.0 · Haus-Register (klar, menschlich).**

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

## Warum Goblins Missbrauchsfläche klein ist (der strukturelle Vorteil)

**Goblin hostet Nutzer-Inhalte NIE öffentlich.** Generierte Apps werden in das **eigene
Vercel-Konto des Nutzers** deployt (Gründer-Entscheidung, endgültig); der Projektspeicher
(B2) ist privat. Goblins Missbrauchsfläche ist damit eng umrissen:

1. **was der Agent zu BAUEN bereit ist** (Generierungs-Ebene, K2),
2. **was die Publish-Pipeline zu Vercel AUSLIEFERT** (Pipeline-Ebene, K3),
3. **Plattform-Ressourcen-Missbrauch** (Raten/Kosten — Wave-D-Gebiet).

Die Hosting-Ebene — und damit die Trust-&-Safety-Maschinerie, die öffentlich gehostete
Inhalte prüft — gehört dem Nutzer und **Vercel**. Das ist kein Schlupfloch, sondern ein
echter Haftungs-Reduzierer, den wir hier offen benennen.

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

4. **Illegale Inhalte.**
   Nichts, was nach geltendem Recht verboten ist — insbesondere kein Material, das Minderjährige
   sexualisiert, keine Anleitungen zu schweren Straftaten, keine rechtswidrigen Waren.

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

### Was passiert, wenn diese Grenzen verletzt werden

Je nach Schwere und Absicht:
- **Projekt-Sperre** — das betroffene Projekt kann nicht (weiter) veröffentlicht werden.
- **Konto-Kündigung** — bei schweren oder wiederholten Verstößen.
- **Meldung an den Hosting-Provider** (Vercel) und, wo gesetzlich geboten, an Behörden.

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

4. **Illegal content.**
   Nothing prohibited by applicable law — in particular no material that sexualizes minors,
   no instructions for serious crimes, no unlawful goods.

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

### Consequences

Depending on severity and intent:
- **Project block** — the project cannot (continue to) be published.
- **Account termination** — for severe or repeated violations.
- **Report to the hosting provider** (Vercel) and, where legally required, to authorities.

We act with proportion: for an honest misunderstanding we talk first; for clear abuse we act
decisively.

### If a block is a mistake

Our automated checks are deliberately cautious but not infallible. If your legitimate app was
wrongly blocked: **use the feedback button** — a human will look at it. We don't want to slow
down honest builders.
