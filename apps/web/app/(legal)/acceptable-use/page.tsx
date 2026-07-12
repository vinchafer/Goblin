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
      <p className="mb-6" style={{ color: "var(--ink-3)", fontSize: 14 }}>Acceptable-Use Policy · Version 1.0</p>

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

      {/* Structural note */}
      <section className="mb-10">
        <p style={P}>
          Goblin hilft dir, echte Software zu bauen und live zu stellen. Deine generierten Apps
          werden dabei in <strong style={{ color: "var(--ink-2)" }}>dein eigenes Vercel-Konto</strong> veröffentlicht —
          Goblin hostet deine Inhalte nicht öffentlich. Damit die Plattform für alle sicher bleibt,
          gelten die folgenden klaren Grenzen.
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
            <strong style={{ color: "var(--ink-2)" }}>Illegale Inhalte.</strong>{" "}
            Nichts, was nach geltendem Recht verboten ist — insbesondere kein Material, das Minderjährige
            sexualisiert, keine Anleitungen zu schweren Straftaten, keine rechtswidrigen Waren.
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
        </ul>

        <h3 style={H3}>Was passiert, wenn diese Grenzen verletzt werden</h3>
        <p style={P}>
          Je nach Schwere und Absicht: <strong style={{ color: "var(--ink-2)" }}>Projekt-Sperre</strong> (das
          Projekt kann nicht weiter veröffentlicht werden), <strong style={{ color: "var(--ink-2)" }}>Konto-Kündigung</strong>{" "}
          (bei schweren oder wiederholten Verstößen) und <strong style={{ color: "var(--ink-2)" }}>Meldung an den
          Hosting-Provider</strong> (Vercel) sowie, wo gesetzlich geboten, an Behörden. Bei einem ehrlichen
          Missverständnis suchen wir zuerst das Gespräch.
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
            <strong style={{ color: "var(--ink-2)" }}>Illegal content.</strong>{" "}
            Nothing prohibited by applicable law — in particular no material that sexualizes minors, no
            instructions for serious crimes, no unlawful goods.
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
        </ul>

        <h3 style={H3}>Consequences</h3>
        <p style={P}>
          Depending on severity and intent: <strong style={{ color: "var(--ink-2)" }}>project block</strong>,{" "}
          <strong style={{ color: "var(--ink-2)" }}>account termination</strong> for severe or repeated violations,
          and <strong style={{ color: "var(--ink-2)" }}>a report to the hosting provider</strong> (Vercel) and, where
          legally required, to authorities.
        </p>

        <h3 style={H3}>If a block is a mistake</h3>
        <p style={P}>
          Our automated checks are deliberately cautious but not infallible. If your legitimate app was
          wrongly blocked, use the <strong style={{ color: "var(--ink-2)" }}>feedback button</strong> — a human will
          look at it.
        </p>
      </section>

      <p className="text-sm" style={{ color: "var(--ink-3)" }}>Stand / Last updated: Juli 2026</p>
    </main>
  );
}
