import Link from "next/link";

// K1 (Wave-K, Layer 1) — the public Acceptable-Use-Policy / Nutzungsrichtlinie.
// Canonical source of the wording: docs/ACCEPTABLE_USE_POLICY.md. This page renders
// both languages (DE primary, EN below), matching Goblin's German-UI + EN-i18n rule.
// Referenced from: signup consent, the legal-layout footer, the landing footer, and —
// by policy area — the K3 publish-block messages ("Wenn das ein Fehler ist: Feedback").

export const metadata = {
  title: "Nutzungsrichtlinie · Goblin",
  description: "Was du mit Goblin bauen und veröffentlichen darfst — und was nicht.",
};

const H2 = { fontSize: 20, fontWeight: 600, marginBottom: 12, color: "var(--ink-1)" } as const;
const H3 = { fontSize: 16, fontWeight: 600, marginTop: 20, marginBottom: 8, color: "var(--ink-1)" } as const;
const P = { marginBottom: 12, color: "var(--ink-3)", lineHeight: 1.6 } as const;
const LI = { marginBottom: 10, color: "var(--ink-3)", lineHeight: 1.6 } as const;

export default function AcceptableUsePage() {
  return (
    <main className="max-w-3xl mx-auto py-16 px-4">
      <nav className="mb-8">
        <Link href="/" className="text-sm" style={{ color: "var(--brand-green)" }}>← Zurück / Back</Link>
      </nav>

      <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--brand-green)" }}>
        Nutzungsrichtlinie
      </h1>
      <p className="mb-6" style={{ color: "var(--ink-3)", fontSize: 14 }}>Acceptable-Use Policy · Version 1.1 · 28. Juli 2026</p>

      {/* Honest legal marker — surfaced on the page itself, not only in the doc. */}
      <div
        className="mb-10"
        style={{
          border: "1px solid var(--brand-gold)",
          borderRadius: 8,
          padding: "12px 16px",
          background: "color-mix(in srgb, var(--brand-gold) 8%, transparent)",
        }}
      >
        <p style={{ color: "var(--ink-2)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          ⚠️ Von KI verfasst, nicht anwaltlich geprüft — vor Skalierung juristisch reviewen lassen.
          <br />
          <span style={{ color: "var(--ink-3)" }}>
            AI-drafted, not reviewed by a lawyer — to be legally reviewed before scaling.
          </span>
        </p>
      </div>

      {/* Structural note — U-B3. Until v1.0 this paragraph asserted "Goblin hostet
          deine Inhalte nicht öffentlich". That is false from AKT 2 · Phase 2 on, where
          Goblin publishes to {name}.justgoblin.app on its own plane. Replaced with the
          two-path split, because which party can actually take content down differs. */}
      <section className="mb-10">
        <p style={P}>
          Goblin hilft dir, echte Software zu bauen und live zu stellen. Dafür gibt es{" "}
          <strong style={{ color: "var(--ink-2)" }}>zwei Wege</strong>:
        </p>
        <ul style={{ paddingLeft: 20, listStyle: "disc" }}>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Dein eigenes Vercel-Konto</strong> (Standard).
            Goblin pusht deinen Code dorthin — die Seite läuft bei dir, unter deiner Kontrolle und auf
            deine Kosten. Abschalten kann dort nur du oder Vercel.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Von Goblin gehostet</strong> auf{" "}
            <code>{"{name}"}.justgoblin.app</code> — derzeit eine{" "}
            <strong style={{ color: "var(--ink-2)" }}>eingeschränkte Beta</strong> für ausgewählte
            Konten. Hier ist Goblin der Hoster und kann Inhalte, die gegen diese Richtlinie verstoßen,
            selbst offline nehmen.
          </li>
        </ul>
        <p style={P}>
          Auf beiden Wegen gelten die folgenden klaren Grenzen. Die vertraglichen Regeln zum Hosting
          stehen in den{" "}
          <Link href="/terms" style={{ color: "var(--brand-green)", textDecoration: "underline" }}>
            Nutzungsbedingungen, Abschnitt 7
          </Link>.
        </p>
      </section>

      {/* ─────────────── DE ─────────────── */}
      <section className="mb-10">
        <h2 style={H2}>Was mit Goblin nicht erlaubt ist</h2>

        <ul style={{ paddingLeft: 20, listStyle: "disc" }}>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Phishing, Credential-Harvesting &amp; Marken-Imitation.</strong>{" "}
            Keine Seiten, die Zugangsdaten abgreifen — auch nicht, indem sie den Login einer bekannten
            Marke (Bank, Bezahldienst, E-Mail-Anbieter, Behörde) nachbauen. Ein Login für <em>deine
            eigene</em> App ist erlaubt; das Nachbauen fremder Marken, um Nutzer zu täuschen, nicht.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Malware &amp; Miner.</strong>{" "}
            Keine Schadsoftware, keine heimlichen Krypto-Miner, kein Code, der ohne Wissen des Besuchers
            dessen Gerät oder Rechenleistung nutzt.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Täuschung &amp; Betrug.</strong>{" "}
            Keine Fake-Shops, erfundenen Gewinnspiele oder Vorschussbetrug-Seiten, die Menschen gezielt
            in die Irre führen, um sie zu schädigen.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Illegale Inhalte (Schweizer Recht).</strong>{" "}
            Nichts, was nach geltendem — insbesondere Schweizer — Recht verboten ist: keine Anleitungen
            zu schweren Straftaten, keine rechtswidrigen Waren, keine rassendiskriminierenden Inhalte.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Null-Toleranz: sexueller Missbrauch Minderjähriger.</strong>{" "}
            Das ist die eine Grenze ohne Ermessen: sofortige Entfernung, sofortige Konto-Kündigung,
            Beweissicherung und Meldung an die Behörden — ohne Vorwarnung und ohne Frist.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Erfassung von Zahlungsdaten außerhalb zertifizierter Anbieter.</strong>{" "}
            Bezahlung über zertifizierte Anbieter (Stripe-Links, PayPal-Buttons u. Ä.) ist erlaubt.
            Eigene Kartenformulare, die Kreditkartennummer, CVV oder IBAN direkt einsammeln, nicht.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Belästigung &amp; Hass.</strong>{" "}
            Keine Seiten, die gezielt Einzelne belästigen oder zu Hass und Gewalt gegen Gruppen aufrufen.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Umgehung der Schutzmechanismen.</strong>{" "}
            Kein Versuch, diese Grenzen, die Prüfungen beim Veröffentlichen oder die technischen Limits
            der Plattform zu umgehen oder zu verschleiern.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Krypto-Drainer &amp; Wallet-Betrug.</strong>{" "}
            Keine Seiten, die eine Wallet verbinden, um sie leerzuräumen — keine gefälschten Airdrops,
            Mint-Seiten oder Token-Freigaben, die etwas anderes vorspielen als das, was der Besucher
            tatsächlich signiert.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Spam, Massenmail &amp; SEO-Linkfarmen.</strong>{" "}
            Kein Versand unerbetener Massen-E-Mails, keine Adress-Sammelseiten dafür, keine
            Doorway-Pages, Linkfarmen oder automatisch erzeugten Textmassen zur Suchmaschinen-Manipulation.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Urheberrechtsverletzungen.</strong>{" "}
            Keine Inhalte, an denen dir die Rechte fehlen — keine raubkopierten Medien, keine
            Software-Cracks, keine Weiterverbreitung fremder Werke ohne Erlaubnis.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Ressourcen-Missbrauch.</strong>{" "}
            Kein Mining, kein Betrieb als offener Proxy oder Relay, keine Traffic-Verstärkung und kein
            absichtliches Ausreizen der Plattform-Limits — auch nicht verteilt über mehrere Konten.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Verarbeitung von Daten ohne Berechtigung.</strong>{" "}
            Nutze deine gehostete App nicht für personenbezogene oder vertrauliche Daten, für die dir
            die Rechtsgrundlage oder Erlaubnis fehlt. Dafür bist du verantwortlich, nicht Goblin.
          </li>
        </ul>

        <h3 style={H3}>Was Goblin prüft — und was nicht</h3>
        <p style={P}>
          Ehrlich, damit du dich nicht auf etwas verlässt, das es nicht gibt: Goblin führt vor dem
          Veröffentlichen <strong style={{ color: "var(--ink-2)" }}>automatische Prüfungen</strong> durch —
          eine feste Regelliste über die Dateien deiner App. Klare Phishing- und Malware-Treffer
          blockieren die Veröffentlichung; schwächere Signale werden nur protokolliert.
        </p>
        <p style={P}>
          Goblin <strong style={{ color: "var(--ink-2)" }}>prüft aber nicht jede App inhaltlich</strong> und
          liest sie nicht durch. Es gibt keine manuelle Vorabkontrolle und keine Rund-um-die-Uhr-Überwachung.
          Auf Meldungen reagieren wir. Die Verantwortung für deine App bleibt bei dir — dass sie
          veröffentlicht wurde, ist keine Freigabe und keine Prüfung durch Goblin.
        </p>

        <h3 style={H3}>Missbrauch melden</h3>
        <p style={P}>
          Verstößt eine von Goblin gehostete App (<code>*.justgoblin.app</code>) gegen diese Richtlinie,
          melde sie an{" "}
          <a href="mailto:support@justgoblin.com" style={{ color: "var(--brand-green)", textDecoration: "underline" }}>
            support@justgoblin.com
          </a>{" "}
          — mit URL und kurzer Beschreibung. Wir zielen darauf ab, glaubwürdige Meldungen innerhalb von
          24 Stunden zu sichten. <em>Das ist ein Ziel, keine Zusicherung</em> — Goblin wird von einer
          Einzelperson betrieben. Liegt die Seite im eigenen Vercel-Konto des Nutzers, ist zusätzlich{" "}
          <a href="https://vercel.com/abuse" style={{ color: "var(--brand-green)", textDecoration: "underline" }}>
            vercel.com/abuse
          </a>{" "}
          der richtige Weg.
        </p>

        <h3 style={H3}>Urheberrechtsbeschwerde</h3>
        <p style={P}>
          Goblin hat den Sitz in der Schweiz; es gilt Schweizer Recht. Wir unterhalten{" "}
          <strong style={{ color: "var(--ink-2)" }}>keinen DMCA-Agenten</strong> und geben keine
          DMCA-Verfahrensgarantien ab. Beschwerden zu von Goblin gehosteten Inhalten gehen an{" "}
          <a href="mailto:support@justgoblin.com" style={{ color: "var(--brand-green)", textDecoration: "underline" }}>
            support@justgoblin.com
          </a>{" "}
          mit: genauer URL, Bezeichnung des geschützten Werks, Nachweis deiner Berechtigung,
          Kontaktdaten und einer Erklärung, dass deine Angaben zutreffen. Ist die Beschwerde plausibel,
          informieren wir den Nutzer und entfernen oder sperren den Inhalt; der Nutzer kann widersprechen.
        </p>

        <h3 style={H3}>Was passiert, wenn diese Grenzen verletzt werden</h3>
        <p style={P}>
          Je nach Schwere und Absicht: <strong style={{ color: "var(--ink-2)" }}>Projekt-Sperre</strong> (das
          Projekt kann nicht weiter veröffentlicht werden),{" "}
          <strong style={{ color: "var(--ink-2)" }}>Abschaltung der gehosteten App</strong> (auf{" "}
          <code>*.justgoblin.app</code> kann Goblin selbst offline nehmen — soweit praktikabel mit
          Benachrichtigung, bei Missbrauchsdarstellungen Minderjähriger oder aktivem Phishing sofort),{" "}
          <strong style={{ color: "var(--ink-2)" }}>Konto-Kündigung</strong> (bei schweren oder wiederholten
          Verstößen) sowie, wo gesetzlich geboten, <strong style={{ color: "var(--ink-2)" }}>Meldung an
          Behörden</strong>. Liegt die Seite im eigenen Vercel-Konto des Nutzers, kann nur Vercel sie
          abschalten — dann melden wir sie dort. Bei einem ehrlichen Missverständnis suchen wir zuerst
          das Gespräch.
        </p>

        <h3 style={H3}>Wenn eine Sperre ein Fehler ist</h3>
        <p style={P}>
          Unsere automatischen Prüfungen sind bewusst vorsichtig, aber nicht unfehlbar. Wurde deine
          legitime App fälschlich blockiert, nutze den <strong style={{ color: "var(--ink-2)" }}>Feedback-Knopf</strong> —
          ein Mensch schaut es sich an.
        </p>
      </section>

      {/* ─────────────── EN ─────────────── */}
      <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "32px 0" }} />

      <section className="mb-10">
        <p style={P}>
          Goblin helps you build and ship real software. There are{" "}
          <strong style={{ color: "var(--ink-2)" }}>two paths</strong>: your{" "}
          <strong style={{ color: "var(--ink-2)" }}>own Vercel account</strong> (the default — the site
          runs under your control and at your cost; only you or Vercel can take it down), and{" "}
          <strong style={{ color: "var(--ink-2)" }}>Goblin-hosted</strong> on{" "}
          <code>{"{name}"}.justgoblin.app</code> — currently a{" "}
          <strong style={{ color: "var(--ink-2)" }}>limited beta</strong> for selected accounts, where
          Goblin is the host and can take violating content offline itself. The limits below apply to
          both. The contractual hosting rules are in the{" "}
          <Link href="/terms" style={{ color: "var(--brand-green)", textDecoration: "underline" }}>
            Terms of Service, section 7
          </Link>.
        </p>

        <h2 style={H2}>What you may not do with Goblin</h2>

        <ul style={{ paddingLeft: 20, listStyle: "disc" }}>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Phishing, credential harvesting &amp; brand impersonation.</strong>{" "}
            No pages that capture credentials — including by imitating a known brand&rsquo;s login. A login for
            <em> your own</em> app is fine; cloning someone else&rsquo;s brand to deceive users is not.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Malware &amp; miners.</strong>{" "}
            No malicious software, covert crypto-miners, or code that uses a visitor&rsquo;s device or compute
            without their knowledge.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Deception &amp; fraud.</strong>{" "}
            No fake shops, fabricated giveaways, or advance-fee scams designed to mislead people to harm them.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Illegal content (Swiss law).</strong>{" "}
            Nothing prohibited by applicable — in particular Swiss — law: no instructions for serious
            crimes, no unlawful goods, no racially discriminatory content.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Zero tolerance: child sexual abuse material.</strong>{" "}
            This is the one limit with no discretion: immediate removal, immediate account termination,
            evidence preservation, and a report to the authorities — without warning and without a
            grace period.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Collecting payment data outside certified providers.</strong>{" "}
            Payments via certified providers (Stripe links, PayPal buttons, etc.) are allowed. Your own card
            forms collecting card number, CVV, or IBAN directly are not.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Harassment &amp; hate.</strong>{" "}
            No pages targeting individuals for harassment, or inciting hatred or violence against groups.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Circumventing safety mechanisms.</strong>{" "}
            No attempt to bypass, trick, or obscure the limits above, the publish-time checks, or the
            platform&rsquo;s technical limits.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Crypto drainers &amp; wallet scams.</strong>{" "}
            No pages that connect a wallet in order to empty it — no fake airdrops, mint pages, or token
            approvals that show the visitor something other than what they actually sign.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Spam, bulk mail &amp; SEO link farms.</strong>{" "}
            No unsolicited bulk email, no address-harvesting pages for it, no doorway pages, link farms,
            or machine-generated bulk text to manipulate search engines.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Copyright infringement.</strong>{" "}
            No content you don&rsquo;t hold the rights to — no pirated media, no software cracks, no
            redistribution of someone else&rsquo;s work without permission.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Resource abuse.</strong>{" "}
            No mining, no running your app as an open proxy or relay, no traffic amplification, and no
            deliberate exhaustion of platform limits — including spread across multiple accounts.
          </li>
          <li style={LI}>
            <strong style={{ color: "var(--ink-2)" }}>Processing data you have no right to process.</strong>{" "}
            Don&rsquo;t use your hosted app for personal or confidential data you have no legal basis or
            permission for. You are responsible for that, not Goblin.
          </li>
        </ul>

        <h3 style={H3}>What Goblin checks — and what it does not</h3>
        <p style={P}>
          Stated honestly, so you don&rsquo;t rely on something that doesn&rsquo;t exist: Goblin runs{" "}
          <strong style={{ color: "var(--ink-2)" }}>automated checks before publishing</strong> — a fixed
          rule list over your app&rsquo;s files. Clear phishing and malware hits block the publish; weaker
          signals are only logged.
        </p>
        <p style={P}>
          But Goblin <strong style={{ color: "var(--ink-2)" }}>does not review the content of every app</strong>{" "}
          and does not read them. There is no manual pre-approval and no round-the-clock monitoring. We do
          react to reports. Responsibility for your app stays with you — the fact that it was published is
          not an approval or a review by Goblin.
        </p>

        <h3 style={H3}>Reporting abuse</h3>
        <p style={P}>
          If a Goblin-hosted app (<code>*.justgoblin.app</code>) violates this policy, report it to{" "}
          <a href="mailto:support@justgoblin.com" style={{ color: "var(--brand-green)", textDecoration: "underline" }}>
            support@justgoblin.com
          </a>{" "}
          with the URL and a short description. We aim to triage credible reports within 24 hours.{" "}
          <em>That is a target, not a warranty</em> — Goblin is run by one person. If the site lives in
          the user&rsquo;s own Vercel account,{" "}
          <a href="https://vercel.com/abuse" style={{ color: "var(--brand-green)", textDecoration: "underline" }}>
            vercel.com/abuse
          </a>{" "}
          is additionally the right route.
        </p>

        <h3 style={H3}>Copyright complaints</h3>
        <p style={P}>
          Goblin is based in Switzerland and Swiss law applies. We do{" "}
          <strong style={{ color: "var(--ink-2)" }}>not maintain a DMCA agent</strong> and make no DMCA
          procedural guarantees. Complaints about Goblin-hosted content go to{" "}
          <a href="mailto:support@justgoblin.com" style={{ color: "var(--brand-green)", textDecoration: "underline" }}>
            support@justgoblin.com
          </a>{" "}
          with: the exact URL, identification of the protected work, evidence of your authority, your
          contact details, and a statement that your information is accurate. Where a complaint is
          plausible we notify the user and remove or suspend the content; the user may object.
        </p>

        <h3 style={H3}>Consequences</h3>
        <p style={P}>
          Depending on severity and intent: <strong style={{ color: "var(--ink-2)" }}>project block</strong>,{" "}
          <strong style={{ color: "var(--ink-2)" }}>takedown of the hosted app</strong> (on{" "}
          <code>*.justgoblin.app</code> Goblin can take it offline itself — with notice where practicable,
          immediately for child sexual abuse material or active phishing),{" "}
          <strong style={{ color: "var(--ink-2)" }}>account termination</strong> for severe or repeated
          violations, and where legally required{" "}
          <strong style={{ color: "var(--ink-2)" }}>a report to authorities</strong>. If the site lives in
          the user&rsquo;s own Vercel account, only Vercel can take it down — we report it there.
        </p>

        <h3 style={H3}>If a block is a mistake</h3>
        <p style={P}>
          Our automated checks are deliberately cautious but not infallible. If your legitimate app was
          wrongly blocked, use the <strong style={{ color: "var(--ink-2)" }}>feedback button</strong> — a human will
          look at it.
        </p>
      </section>

      {/* Changelog — "Was sich geändert hat" (U-B5). */}
      <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "32px 0" }} />
      <section className="mb-8">
        <h2 style={H2}>Was sich geändert hat / What changed</h2>
        <p style={{ ...P, fontSize: 14 }}>
          <strong style={{ color: "var(--ink-2)" }}>Version 1.1 · 28. Juli 2026</strong> — Bisher stand
          hier, Goblin hoste deine Inhalte nicht öffentlich. Das stimmt nicht mehr: Goblin kann Apps
          künftig selbst auf <code>{"{name}"}.justgoblin.app</code> veröffentlichen (eingeschränkte Beta).
          Neu sind außerdem die Grenzen zu Krypto-Drainern, Spam/SEO-Linkfarmen, Urheberrecht,
          Ressourcen-Missbrauch und Datenverarbeitung ohne Berechtigung, die ausdrückliche
          Null-Toleranz-Regel, der Abschnitt „Was Goblin prüft — und was nicht", der Meldeweg{" "}
          <code>support@justgoblin.com</code> und das Urheberrechts-Beschwerdeverfahren.
        </p>
        <p style={{ ...P, fontSize: 14 }}>
          <strong style={{ color: "var(--ink-2)" }}>Version 1.1 · 28 July 2026</strong> — This page
          previously said Goblin does not host your content publicly. That is no longer true: Goblin can
          now publish apps to <code>{"{name}"}.justgoblin.app</code> itself (limited beta). Also new: the
          limits on crypto drainers, spam/SEO link farms, copyright, resource abuse and processing data
          without authorisation; the explicit zero-tolerance rule; the section on what Goblin does and
          does not check; the <code>support@justgoblin.com</code> reporting route; and the copyright
          complaint procedure.
        </p>
      </section>

      <p className="text-sm" style={{ color: "var(--ink-3)" }}>
        Stand / Last updated: 28. Juli 2026 · Version 1.1 ·{" "}
        <Link href="/terms" style={{ color: "var(--brand-green)", textDecoration: "underline" }}>
          Nutzungsbedingungen / Terms
        </Link>
      </p>
    </main>
  );
}
