import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto py-16 px-4">
      <nav className="mb-8">
        <Link href="/" className="text-sm" style={{ color: 'var(--brand-green)' }}>← Back</Link>
      </nav>

      <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--brand-green)' }}>Terms of Service</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>1. Acceptance</h2>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          By accessing or using Goblin, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use our service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>2. Usage Rights</h2>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          Goblin grants you a personal, non-exclusive, non-transferable license to use the service for your own projects. You retain all rights to the code you create.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>3. User Responsibilities</h2>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          You are responsible for your account security. You agree not to use Goblin for illegal purposes, spam, or malicious activities.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>4. Payments & Cancellation</h2>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          Subscriptions are billed monthly. You may cancel at any time. Cancellations take effect at the end of your current billing period. No partial refunds.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>5. Limitation of Liability</h2>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          Goblin is provided "as is". We are not liable for any damages arising from your use of the service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>6. Changes</h2>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          We reserve the right to modify these terms at any time. We will notify users of significant changes via email.
        </p>
      </section>

      {/* ── 7. Goblin-hosted apps ────────────────────────────────────────────
          AKT 2 · U-B2. Added because Phase 2 publishes user apps to
          {name}.justgoblin.app on Goblin's own infrastructure — which the AUP
          previously (and now falsely) denied. Bilingual DE+EN following the
          /acceptable-use pattern, because this section is new and the honesty
          rule requires German parity for text real users are reading today.

          HONESTY CONSTRAINTS APPLIED HERE (do not soften on edit):
          - no SLA, no uptime promise, no "24/7", no monitoring claim
          - the backup wording is a RIGHTS GRANT (permission to make copies),
            never a promise that backups exist or can be restored
          - beta status is stated plainly, not buried
          - the 30-day grace period is a founder decision, not a guess to hide */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>
          7. Von Goblin gehostete Apps / Goblin-hosted apps
        </h2>

        {/* ─────────────── DE ─────────────── */}
        <h3 className="text-base font-semibold mt-6 mb-2" style={{ color: 'var(--ink-2)' }}>Deutsch</h3>

        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          <strong style={{ color: 'var(--ink-2)' }}>Was das ist.</strong> Goblin kann Apps, die du mit
          Goblin erstellst, auf einer von Goblin betriebenen Subdomain veröffentlichen
          (<code>{'{name}'}.justgoblin.app</code>). Diese Funktion ist derzeit eine
          <strong style={{ color: 'var(--ink-2)' }}> eingeschränkte Beta</strong> und nur für ausgewählte
          Konten freigeschaltet. Es besteht kein Anspruch auf Zugang.
        </p>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          <strong style={{ color: 'var(--ink-2)' }}>Deine Inhalte bleiben deine.</strong> Du behältst alle
          Rechte an deinem Code und deinen Inhalten und bist für sie verantwortlich. Du räumst Goblin nur
          die technischen Rechte ein, die nötig sind, um den Dienst zu betreiben: deine Inhalte zu
          speichern, zu vervielfältigen, auszuliefern und Sicherungskopien anzulegen. Dieses Recht ist auf
          den Betrieb des Dienstes beschränkt und endet, wenn deine Inhalte entfernt werden.
          <em> Dass Goblin Sicherungskopien anlegen darf, ist eine Erlaubnis — keine Zusage, dass
          Sicherungen existieren oder wiederherstellbar sind.</em> Führe eigene Sicherungen.
        </p>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          <strong style={{ color: 'var(--ink-2)' }}>Du bist nicht eingesperrt.</strong> Der bisherige Weg
          — die Verbindung deines eigenen Vercel-Kontos — bleibt bestehen. Der Code-Export ist jederzeit
          verfügbar. Gehen kostet nichts.
        </p>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          <strong style={{ color: 'var(--ink-2)' }}>Grenzen und Durchsetzung.</strong> Es gilt die{' '}
          <Link href="/acceptable-use" style={{ color: 'var(--brand-green)', textDecoration: 'underline' }}>
            Nutzungsrichtlinie
          </Link>. Goblin kann das Veröffentlichen verweigern sowie gehostete Inhalte sperren oder
          entfernen, die dagegen verstoßen — soweit praktikabel mit Benachrichtigung an dich, bei
          schweren Fällen (z. B. Darstellungen sexuellen Missbrauchs Minderjähriger, aktives Phishing)
          auch sofort und ohne Vorankündigung.
        </p>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          <strong style={{ color: 'var(--ink-2)' }}>Verfügbarkeit — ohne Garantie.</strong> Es gibt
          <strong style={{ color: 'var(--ink-2)' }}> kein Service-Level-Agreement und keine zugesicherte
          Verfügbarkeit</strong>. Der Dienst befindet sich in der Beta und kann ausfallen, sich ändern
          oder eingestellt werden. Goblin betreibt ihn mit Sorgfalt und berichtet den Zustand ehrlich —
          mehr wird an dieser Stelle bewusst nicht versprochen.
        </p>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          <strong style={{ color: 'var(--ink-2)' }}>Subdomains werden zugeteilt, nicht verkauft.</strong>{' '}
          Du erwirbst kein Eigentum an einem Namen unter <code>justgoblin.app</code>. Goblin kann Namen
          zurückfordern, die reserviert, irreführend oder rechtsverletzend sind.
        </p>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          <strong style={{ color: 'var(--ink-2)' }}>Ende von Konto oder Plan.</strong> Endet dein Konto
          oder dein Plan, bleibt eine gehostete App noch <strong style={{ color: 'var(--ink-2)' }}>30 Tage
          </strong> erreichbar, damit du deinen Code und deine Inhalte exportieren kannst. Danach werden
          die App und ihre Dateien entfernt und die Subdomain wird freigegeben. Bei einer Sperre wegen
          eines schweren Verstoßes gegen die Nutzungsrichtlinie entfällt diese Frist.
        </p>

        {/* ─────────────── EN ─────────────── */}
        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '24px 0' }} />
        <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--ink-2)' }}>English</h3>

        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          <strong style={{ color: 'var(--ink-2)' }}>What this is.</strong> Goblin can publish apps you
          create with Goblin to a Goblin-operated subdomain (<code>{'{name}'}.justgoblin.app</code>).
          This feature is currently a <strong style={{ color: 'var(--ink-2)' }}>limited beta</strong> and
          is enabled only for selected accounts. There is no entitlement to access.
        </p>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          <strong style={{ color: 'var(--ink-2)' }}>Your content stays yours.</strong> You keep all rights
          to your code and content, and you are responsible for it. You grant Goblin only the technical
          rights needed to operate the service: to store, copy, serve, and make backup copies of your
          content. That grant is limited to operating the service and ends when your content is removed.
          <em> Permission to make backups is a permission — not a promise that backups exist or can be
          restored.</em> Keep your own copies.
        </p>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          <strong style={{ color: 'var(--ink-2)' }}>You are not locked in.</strong> The existing path —
          connecting your own Vercel account — remains available. Code export is available at any time.
          Leaving is free.
        </p>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          <strong style={{ color: 'var(--ink-2)' }}>Limits and enforcement.</strong> The{' '}
          <Link href="/acceptable-use" style={{ color: 'var(--brand-green)', textDecoration: 'underline' }}>
            Acceptable-Use Policy
          </Link>{' '}
          applies. Goblin may refuse to publish, and may suspend or remove hosted content that violates
          it — with notice to you where practicable, and immediately without prior notice in severe cases
          (for example child sexual abuse material or active phishing).
        </p>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          <strong style={{ color: 'var(--ink-2)' }}>Availability — without a guarantee.</strong> There is
          <strong style={{ color: 'var(--ink-2)' }}> no service-level agreement and no promised
          availability</strong>. The service is in beta and may break, change, or be discontinued. Goblin
          operates it with care and reports its state honestly — deliberately, nothing more is promised
          here.
        </p>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          <strong style={{ color: 'var(--ink-2)' }}>Subdomains are assigned, not sold.</strong> You
          acquire no ownership in any name under <code>justgoblin.app</code>. Goblin may reclaim names
          that are reserved, misleading, or infringing.
        </p>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          <strong style={{ color: 'var(--ink-2)' }}>When your account or plan ends.</strong> A hosted app
          stays reachable for <strong style={{ color: 'var(--ink-2)' }}>30 days</strong> so you can export
          your code and content. After that the app and its files are removed and the subdomain is
          released. This grace period does not apply to a suspension for a severe Acceptable-Use
          violation.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>
          8. Missbrauch melden / Reporting abuse
        </h2>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          Wenn eine von Goblin gehostete App gegen die Nutzungsrichtlinie verstößt, melde sie an{' '}
          <a href="mailto:abuse@justgoblin.com" style={{ color: 'var(--brand-green)', textDecoration: 'underline' }}>
            abuse@justgoblin.com
          </a>{' '}
          — mit URL und einer kurzen Beschreibung. Näheres in der{' '}
          <Link href="/acceptable-use" style={{ color: 'var(--brand-green)', textDecoration: 'underline' }}>
            Nutzungsrichtlinie
          </Link>.
        </p>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          If a Goblin-hosted app violates the Acceptable-Use Policy, report it to{' '}
          <a href="mailto:abuse@justgoblin.com" style={{ color: 'var(--brand-green)', textDecoration: 'underline' }}>
            abuse@justgoblin.com
          </a>{' '}
          with the URL and a short description. Details in the{' '}
          <Link href="/acceptable-use" style={{ color: 'var(--brand-green)', textDecoration: 'underline' }}>
            Acceptable-Use Policy
          </Link>.
        </p>
      </section>

      {/* Changelog — "Was sich geändert hat" (U-B5). Users who already accepted
          these terms deserve to see what moved, not just a new date. */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>
          Was sich geändert hat / What changed
        </h2>
        <p className="mb-2" style={{ color: 'var(--ink-3)', fontSize: 14 }}>
          <strong style={{ color: 'var(--ink-2)' }}>28. Juli 2026</strong> — Abschnitt 7 (von Goblin
          gehostete Apps) und Abschnitt 8 (Missbrauch melden) neu. Hintergrund: Goblin kann Apps künftig
          selbst auf einer Subdomain veröffentlichen. Bisher stand an anderer Stelle, Goblin hoste
          Inhalte nie öffentlich — das wäre ab dieser Funktion falsch und wurde korrigiert.
        </p>
        <p className="mb-2" style={{ color: 'var(--ink-3)', fontSize: 14 }}>
          <strong style={{ color: 'var(--ink-2)' }}>28 July 2026</strong> — new section 7 (Goblin-hosted
          apps) and section 8 (reporting abuse). Background: Goblin can now publish apps to a
          Goblin-operated subdomain. Text elsewhere previously said Goblin never hosts content publicly;
          that would be false once this feature ships, and has been corrected.
        </p>
      </section>

      <div
        className="mb-8"
        style={{
          border: '1px solid var(--brand-gold)',
          borderRadius: 8,
          padding: '12px 16px',
          background: 'color-mix(in srgb, var(--brand-gold) 8%, transparent)',
        }}
      >
        <p style={{ color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          ⚠️ Abschnitte 7–8 sind von KI verfasst und nicht anwaltlich geprüft — vor Skalierung juristisch
          reviewen lassen.
          <br />
          <span style={{ color: 'var(--ink-3)' }}>
            Sections 7–8 are AI-drafted and not reviewed by a lawyer — to be legally reviewed before
            scaling.
          </span>
        </p>
      </div>

      <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
        Last updated / Stand: 28 July 2026 · Sections 1–6 unchanged since April 2026
      </p>
    </main>
  );
}