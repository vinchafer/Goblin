import Link from "next/link";

export default function ImprintPage() {
  return (
    <main className="max-w-3xl mx-auto py-16 px-4">
      <nav className="mb-8">
        <Link href="/" className="text-sm" style={{ color: 'var(--goblin-moss)' }}>← Back</Link>
      </nav>

      <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--goblin-moss)' }}>Imprint</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--goblin-slate)' }}>Contact</h2>
        <p className="mb-2" style={{ color: 'var(--goblin-gray)' }}>[YOUR NAME]</p>
        <p className="mb-2" style={{ color: 'var(--goblin-gray)' }}>[YOUR ADDRESS]</p>
        <p className="mb-2" style={{ color: 'var(--goblin-gray)' }}>[POSTAL CODE] [CITY]</p>
        <p className="mb-2" style={{ color: 'var(--goblin-gray)' }}>Switzerland</p>
        <p className="mb-2" style={{ color: 'var(--goblin-gray)' }}>Email: [YOUR EMAIL]</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--goblin-slate)' }}>VAT Number</h2>
        <p style={{ color: 'var(--goblin-gray)' }}>CHE-XXX.XXX.XXX MWST</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--goblin-slate)' }}>Disclaimer</h2>
        <p className="mb-3" style={{ color: 'var(--goblin-gray)' }}>
          The contents of this website were created with the utmost care. However, we cannot guarantee the accuracy, completeness and timeliness of the content.
        </p>
      </section>
    </main>
  );
}