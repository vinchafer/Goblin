import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About · Goblin",
  description: "Who we are and why we build Goblin — a cloud IDE for vibe coders.",
};

export default function AboutPage() {
  return (
    <main className="max-w-2xl mx-auto py-16 px-4">
      <nav className="mb-8">
        <Link href="/" className="text-sm" style={{ color: "var(--brand-green)" }}>← Back</Link>
      </nav>

      <h1 className="text-3xl font-semibold mb-8" style={{ color: "var(--brand-green)" }}>About</h1>

      <div style={{ color: "var(--ink-2)", fontSize: 16.5, lineHeight: 1.7 }}>
        <p className="mb-5">
          We build Goblin because building software on the web should feel calm, not
          cluttered. Most tools force a choice: a chat that can&apos;t touch the code, or a
          full IDE you&apos;d better be an engineer to use. We wanted the middle — and we
          wanted it to work from a phone.
        </p>
        <p className="mb-5">
          Goblin is a cloud IDE for vibe coders. You talk to it like a chat; it writes
          code you can read, edit if you want, and ship when you mean to. There is a
          deliberate gap between a draft, a saved version, and something published live —
          because shipping should be a decision, never a reflex.
        </p>
        <p className="mb-5">
          We are a small, independent operation based in Switzerland. We are not chasing
          feature parity with the loudest tools on the market. We are chasing restraint:
          fewer knobs, clearer paths, a product that respects your attention.
        </p>
        <p>
          If that resonates, you&apos;re who we build for.
        </p>
      </div>

      <div className="mt-10" style={{ borderTop: "1px solid var(--line, rgba(15,43,30,.12))", paddingTop: 20 }}>
        <Link href="/manifesto" className="text-sm" style={{ color: "var(--brand-green)", textDecoration: "underline" }}>
          Read the manifesto →
        </Link>
      </div>
    </main>
  );
}
