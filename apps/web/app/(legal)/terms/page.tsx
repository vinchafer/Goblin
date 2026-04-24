import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto py-16 px-4">
      <nav className="mb-8">
        <Link href="/" className="text-sm" style={{ color: 'var(--goblin-moss)' }}>← Back</Link>
      </nav>

      <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--goblin-moss)' }}>Terms of Service</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--goblin-slate)' }}>1. Acceptance</h2>
        <p className="mb-3" style={{ color: 'var(--goblin-gray)' }}>
          By accessing or using Goblin, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use our service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--goblin-slate)' }}>2. Usage Rights</h2>
        <p className="mb-3" style={{ color: 'var(--goblin-gray)' }}>
          Goblin grants you a personal, non-exclusive, non-transferable license to use the service for your own projects. You retain all rights to the code you create.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--goblin-slate)' }}>3. User Responsibilities</h2>
        <p className="mb-3" style={{ color: 'var(--goblin-gray)' }}>
          You are responsible for your account security. You agree not to use Goblin for illegal purposes, spam, or malicious activities.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--goblin-slate)' }}>4. Payments & Cancellation</h2>
        <p className="mb-3" style={{ color: 'var(--goblin-gray)' }}>
          Subscriptions are billed monthly. You may cancel at any time. Cancellations take effect at the end of your current billing period. No partial refunds.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--goblin-slate)' }}>5. Limitation of Liability</h2>
        <p className="mb-3" style={{ color: 'var(--goblin-gray)' }}>
          Goblin is provided "as is". We are not liable for any damages arising from your use of the service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--goblin-slate)' }}>6. Changes</h2>
        <p className="mb-3" style={{ color: 'var(--goblin-gray)' }}>
          We reserve the right to modify these terms at any time. We will notify users of significant changes via email.
        </p>
      </section>

      <p className="text-sm" style={{ color: 'var(--goblin-gray)' }}>Last updated: April 2026</p>
    </main>
  );
}