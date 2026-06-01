import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manifesto · Goblin",
  description: "Simplicity is the moat. Why Goblin chooses restraint.",
};

export default function ManifestoPage() {
  return (
    <main className="max-w-2xl mx-auto py-16 px-4">
      <nav className="mb-8">
        <Link href="/" className="text-sm" style={{ color: "var(--brand-green)" }}>← Back</Link>
      </nav>

      <h1 className="text-3xl font-semibold mb-3" style={{ color: "var(--brand-green)" }}>Manifesto</h1>
      <p className="mb-8" style={{ color: "var(--ink-3)", fontSize: 15, fontStyle: "italic" }}>
        Simplicity is the moat.
      </p>

      <div style={{ color: "var(--ink-2)", fontSize: 16.5, lineHeight: 1.75 }}>
        <p className="mb-5">
          Every tool we admire eventually drowns in its own features. A clean idea ships,
          finds users, and then grows a settings panel for every edge case until the thing
          that made it good is buried three menus deep. We think the harder, rarer
          discipline is to <em>not</em> add — to keep the surface small on purpose.
        </p>
        <p className="mb-5">
          So Goblin has one accent colour, one primary action per screen, and one path
          from idea to live: <strong>draft → saved → published</strong>. Nothing reaches
          the world until you say so, twice. The editor is light by default because you
          should be able to read your own code. The phone is a first-class place to build,
          not an afterthought.
        </p>
        <p className="mb-5">
          We&apos;d rather do less and have it be obvious than do everything and have it be
          a maze. When we&apos;re unsure whether to add something, the default answer is no.
          When we&apos;re unsure whether to remove something, we try removing it.
        </p>
        <p>
          Restraint is not a limitation we tolerate. It&apos;s the product.
        </p>
      </div>

      <div className="mt-10" style={{ borderTop: "1px solid var(--line, rgba(15,43,30,.12))", paddingTop: 20 }}>
        <Link href="/changelog" className="text-sm" style={{ color: "var(--brand-green)", textDecoration: "underline" }}>
          See what we&apos;ve shipped →
        </Link>
      </div>
    </main>
  );
}
