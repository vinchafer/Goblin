import Link from "next/link";

// FIX2-1 (BUG-7): real, founder-supplied public display data baked as the live
// defaults so /imprint renders correctly WITHOUT any Vercel env. Env may still
// override if set, but these are the truth now. NOT VAT-registered → no VAT line
// (we do not invent a CHE number).
const name    = process.env.NEXT_PUBLIC_IMPRINT_NAME    || 'Goblin';
const address = process.env.NEXT_PUBLIC_IMPRINT_ADDRESS || 'Alte Bahnhofstrasse 3, 7250 Klosters, Schweiz';
const email   = process.env.NEXT_PUBLIC_IMPRINT_EMAIL   || 'vincent@justgoblin.com';
const vat     = process.env.NEXT_PUBLIC_IMPRINT_VAT     || '';

export default function ImprintPage() {
  return (
    <main className="max-w-3xl mx-auto py-16 px-4">
      <nav className="mb-8">
        <Link href="/" className="text-sm" style={{ color: 'var(--brand-green)' }}>← Back</Link>
      </nav>

      <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--brand-green)' }}>Impressum</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>Kontakt</h2>
        <p className="mb-2" style={{ color: 'var(--ink-3)' }}>{name}</p>
        <p className="mb-2" style={{ color: 'var(--ink-3)' }}>{address}</p>
        <p className="mb-2" style={{ color: 'var(--ink-3)' }}>
          E-Mail:{' '}
          <a href={`mailto:${email}`} style={{ color: 'var(--brand-green)', textDecoration: 'underline' }}>{email}</a>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>Verantwortlich für den Inhalt</h2>
        <p style={{ color: 'var(--ink-3)' }}>{name}</p>
      </section>

      {vat && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>MwSt</h2>
          <p className="mb-2" style={{ color: 'var(--ink-3)' }}>{vat}</p>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>Haftung für Inhalte</h2>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          Die Inhalte dieser Website wurden mit grösster Sorgfalt erstellt. Für die
          Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch
          keine Gewähr übernehmen.
        </p>
      </section>
    </main>
  );
}
