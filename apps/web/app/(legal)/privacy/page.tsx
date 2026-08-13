import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto py-16 px-4">
      <nav className="mb-8">
        <Link href="/" className="text-sm" style={{ color: 'var(--brand-green)' }}>← Back</Link>
      </nav>

      <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--brand-green)' }}>Privacy Policy</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>1. Data Collection</h2>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          We collect only the data necessary to operate the service: email address, payment information, user projects and API keys.
        </p>
      </section>

      {/* WAVE-I I3 — the honest usage-events paragraph, DE + EN. */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>1a. Usage events / Nutzungsereignisse</h2>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          We record usage events — which feature was used and when (for example: a
          project created, a message sent, an app published, an upgrade clicked) —
          to understand where the product works and where people get stuck. These
          events contain metadata only: never your message content, never your
          file contents, and never the code that is generated. They are personal
          data, retained only as long as your account exists and erased when you
          delete your account.
        </p>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          Wir erfassen Nutzungsereignisse — welche Funktion wann verwendet wurde
          (z.&nbsp;B. ein Projekt erstellt, eine Nachricht gesendet, eine App
          veröffentlicht, ein Upgrade angeklickt) — um zu verstehen, wo das Produkt
          funktioniert und wo Menschen hängen bleiben. Diese Ereignisse enthalten
          nur Metadaten: nie Inhalte deiner Nachrichten, nie Inhalte deiner
          Dateien und nie den generierten Code. Sie sind personenbezogene Daten,
          werden nur so lange gespeichert, wie dein Konto besteht, und mit der
          Löschung deines Kontos entfernt.
        </p>
      </section>

      {/* WAVE-J I3 — support + feedback data, DE + EN. */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>1b. Support &amp; feedback / Support &amp; Feedback</h2>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          When you chat with the Goblin Hilfe support agent or send feedback, we
          process what you write to help you and to improve the product. If your
          request is handed to a human, a bounded transcript of that conversation
          plus context (your plan, whether Vercel is connected, the last error) is
          emailed to us and stored as a support ticket so we can reply. Feedback is
          stored with metadata only (current page, project ID, last error) — never
          your chat content or files. All of this is deleted when you delete your
          account.
        </p>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          Wenn du mit dem Goblin-Hilfe-Agenten chattest oder Feedback sendest,
          verarbeiten wir, was du schreibst, um dir zu helfen und das Produkt zu
          verbessern. Wird dein Anliegen an einen Menschen übergeben, werden ein
          begrenzter Gesprächsverlauf sowie Kontext (dein Plan, ob Vercel verbunden
          ist, die letzte Fehlermeldung) an uns per E-Mail geschickt und als
          Support-Ticket gespeichert, damit wir antworten können. Feedback wird nur
          mit Metadaten gespeichert (aktuelle Seite, Projekt-ID, letzte
          Fehlermeldung) — nie deine Chat-Inhalte oder Dateien. All das wird mit der
          Löschung deines Kontos entfernt.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>2. Sub-processors</h2>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          We use the following trusted third-party services to operate Goblin:
        </p>
        <ul className="list-disc pl-5 space-y-1" style={{ color: 'var(--ink-3)' }}>
          <li>Supabase — database &amp; authentication</li>
          <li>Stripe — payment processing</li>
          <li>Backblaze B2 (EU, eu-central-003) — encrypted project &amp; file storage</li>
          <li>Vercel — web application hosting</li>
          <li>Railway — API hosting</li>
          {/* AKT 2 · U-B1 item G1, closed 2026-07-28 on founder authorisation.
              Cloudflare becomes a sub-processor for Goblin-hosted Living Apps
              (Phase 2). Region facts are stated as configured and verified, NOT
              assumed: the R2 endpoint is the EU-jurisdiction host
              (<hash>.eu.r2.cloudflarestorage.com, bucket goblin-apps — see
              evidence/akt2-phase1/roundtrip-local-2026-07-28-r2-3of3.README.md).
              Workers and KV are Cloudflare's globally distributed edge by design,
              so they are NOT described as EU-confined — saying otherwise would be
              the kind of comfortable falsehood this whole PR exists to remove. */}
          <li>
            Cloudflare — Hosting und Auslieferung der von Nutzern veröffentlichten
            Apps (<code>*.justgoblin.app</code>); genutzte Dienste: Workers, R2,
            KV. Der R2-Speicher ist in der EU-Jurisdiktion konfiguriert; Workers
            und KV laufen auf Cloudflares global verteiltem Edge-Netz, sind also
            nicht auf die EU begrenzt. Betrifft nur Apps, die über das
            Goblin-Hosting veröffentlicht werden — derzeit eine eingeschränkte
            Beta für ausgewählte Konten.
            <br />
            <span>
              Cloudflare — hosting and delivery of user-published apps
              (<code>*.justgoblin.app</code>); services used: Workers, R2, KV. R2
              storage is configured in the EU jurisdiction; Workers and KV run on
              Cloudflare&rsquo;s globally distributed edge network and are
              therefore not EU-confined. Applies only to apps published via Goblin
              hosting — currently a limited beta for selected accounts.
            </span>
          </li>
          <li>Resend — transactional email</li>
          <li>
            DeepInfra (United States) — inference for the Goblin-bundled models.
            SOC&nbsp;2 / ISO&nbsp;27001 certified; zero data retention for the
            open-source models we use; international transfers covered by EU
            Standard Contractual Clauses (SCCs).
            {/* AKT 2 · PHASE 3 · U3.1 — a NEW purpose for an existing sub-processor,
                disclosed in the same PR as the mechanism. Until now everything sent
                to DeepInfra was something the user typed. The pre-publish classifier
                sends the app's own source, automatically, without a prompt — which a
                user would not expect from the sentence above on its own. */}
            <br />
            <span>
              Seit AKT&nbsp;2 · Phase&nbsp;3 zusätzlich: Beim Veröffentlichen auf
              dem Goblin-Hosting (<code>*.justgoblin.app</code>) wird der Text und
              das Markup der zu veröffentlichenden App einmalig an dieses Modell
              übergeben — als automatische Missbrauchsprüfung vor dem Livegang
              (Nutzungsrichtlinie, „Was Goblin prüft"). Das geschieht ohne
              Eingabe des Nutzers und betrifft nur den gehosteten Weg, nicht den
              Vercel-Weg und nicht die übrigen Projektdateien.
              <br />
              Since ACT&nbsp;2 · Phase&nbsp;3, additionally: when publishing on
              Goblin hosting (<code>*.justgoblin.app</code>), the text and markup
              of the app being published are passed once to this model as an
              automated abuse check before it goes live (AUP, &ldquo;What Goblin
              checks&rdquo;). This happens without any user input and applies only
              to the hosted path — not the Vercel path, and not your other project
              files.
            </span>
          </li>
          <li>
            Anthropic, OpenAI and other model providers — only when you connect
            your own API key (BYOK). Your prompts are sent to the provider you
            choose, under your own account and their terms.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>3. AI Processing &amp; International Transfers</h2>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          When you use the Goblin-bundled models (no key required), your prompt and
          the relevant code context are sent to our inference sub-processor for
          processing. That provider operates in the United States. We rely on EU
          Standard Contractual Clauses (SCCs) as the transfer mechanism, and use
          only open-source models configured for zero data retention — your inputs
          are not retained by the provider and are never used to train models.
        </p>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          When you bring your own API key (BYOK), your prompts go directly to the
          provider you selected, under your own account and their terms.
        </p>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          Your stored projects and files remain encrypted at rest in the EU
          (Backblaze B2, eu-central-003). Only the inference step may be processed
          outside the EU, under the safeguards described above.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>4. Data Security</h2>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          All sensitive data is encrypted at rest. API keys are encrypted with AES-256-GCM before storage. We never train our models on user code.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>5. User Rights</h2>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          You may request export or deletion of your personal data at any time by contacting support.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>6. Cookies</h2>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          We only use strictly necessary cookies for authentication. No tracking, no analytics, no third party cookies.
        </p>
      </section>

      <p className="text-sm" style={{ color: 'var(--ink-3)' }}>Last updated: June 2026</p>
    </main>
  );
}