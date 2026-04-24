import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto py-16 px-4">
      <nav className="mb-8">
        <Link href="/" className="text-sm" style={{ color: 'var(--goblin-moss)' }}>← Back</Link>
      </nav>

      <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--goblin-moss)' }}>Privacy Policy</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--goblin-slate)' }}>1. Data Collection</h2>
        <p className="mb-3" style={{ color: 'var(--goblin-gray)' }}>
          We collect only the data necessary to operate the service: email address, payment information, user projects and API keys.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--goblin-slate)' }}>2. Sub-processors</h2>
        <p className="mb-3" style={{ color: 'var(--goblin-gray)' }}>
          We use the following trusted third party services:
        </p>
        <ul className="list-disc pl-5 space-y-1" style={{ color: 'var(--goblin-gray)' }}>
          <li>Supabase (Database & Authentication)</li>
          <li>Stripe (Payment Processing)</li>
          <li>Anthropic (AI Models)</li>
          <li>OpenAI (AI Models)</li>
          <li>Hetzner (Hosting)</li>
          <li>Vercel (Edge Hosting)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--goblin-slate)' }}>3. Data Security</h2>
        <p className="mb-3" style={{ color: 'var(--goblin-gray)' }}>
          All sensitive data is encrypted at rest. API keys are encrypted with AES-256-GCM before storage. We never train our models on user code.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--goblin-slate)' }}>4. User Rights</h2>
        <p className="mb-3" style={{ color: 'var(--goblin-gray)' }}>
          You may request export or deletion of your personal data at any time by contacting support.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--goblin-slate)' }}>5. Cookies</h2>
        <p className="mb-3" style={{ color: 'var(--goblin-gray)' }}>
          We only use strictly necessary cookies for authentication. No tracking, no analytics, no third party cookies.
        </p>
      </section>

      <p className="text-sm" style={{ color: 'var(--goblin-gray)' }}>Last updated: April 2026</p>
    </main>
  );
}