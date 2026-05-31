import Link from "next/link";

const name    = process.env.NEXT_PUBLIC_IMPRINT_NAME    ?? '[YOUR NAME]';
const address = process.env.NEXT_PUBLIC_IMPRINT_ADDRESS ?? '[YOUR ADDRESS]';
const vat     = process.env.NEXT_PUBLIC_IMPRINT_VAT     ?? 'CHE-XXX.XXX.XXX MWST';
const email   = process.env.NEXT_PUBLIC_IMPRINT_EMAIL   ?? '[YOUR EMAIL]';

export default function ImprintPage() {
  return (
    <main className="max-w-3xl mx-auto py-16 px-4">
      <nav className="mb-8">
        <Link href="/" className="text-sm" style={{ color: 'var(--brand-green)' }}>← Back</Link>
      </nav>

      <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--brand-green)' }}>Imprint</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>Contact</h2>
        <p className="mb-2" style={{ color: 'var(--ink-3)' }}>{name}</p>
        <p className="mb-2" style={{ color: 'var(--ink-3)' }}>{address}</p>
        <p className="mb-2" style={{ color: 'var(--ink-3)' }}>Switzerland</p>
        <p className="mb-2" style={{ color: 'var(--ink-3)' }}>Email: {email}</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>Responsible for Content</h2>
        <p className="mb-2" style={{ color: 'var(--ink-3)' }}>{name}</p>
        <p style={{ color: 'var(--ink-3)' }}>{address}, Switzerland</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>VAT</h2>
        <p className="mb-2" style={{ color: 'var(--ink-3)' }}>{vat}</p>
        <p style={{ color: 'var(--ink-3)' }}>
          Subject to Swiss VAT from CHF 100,000 annual turnover (threshold not currently reached).
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>Dispute Resolution</h2>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          The EU Commission provides a platform for online dispute resolution (ODR):{' '}
          <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-green)', textDecoration: 'underline' }}>
            https://ec.europa.eu/consumers/odr/
          </a>. We are neither obliged nor willing to participate in dispute resolution
          proceedings before a consumer arbitration board.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-1)' }}>Disclaimer</h2>
        <p className="mb-3" style={{ color: 'var(--ink-3)' }}>
          The contents of this website were created with the utmost care. However, we cannot guarantee the accuracy, completeness and timeliness of the content.
        </p>
      </section>
    </main>
  );
}
