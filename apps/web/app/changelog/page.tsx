import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Changelog · Goblin",
  description: "What we've shipped recently.",
};

interface Entry { date: string; items: string[] }

// Static for beta — a curated list of meaningful, user-facing changes. Kept honest:
// features still rolling out are marked as such rather than announced as live.
const ENTRIES: Entry[] = [
  {
    date: "June 2026",
    items: [
      "Readable primary buttons across the dashboard (fixed a low-contrast green-on-green).",
      "Per-session AI coding workspace with an in-tab composer — rolling out.",
      "Draft review actions: copy or discard a generated file before you save it.",
    ],
  },
  {
    date: "Late May 2026",
    items: [
      "Light-by-default code editor — you can finally read your code on paper, not a black void. A warm dark theme is one toggle away.",
      "A deliberate gap between Save and Publish: code lands as a draft, you save it, then you publish on purpose. No more reflex deploys.",
      "Calmer chat: code blocks now show equal-weight Copy and Send-to-Code actions.",
      "Mobile hero and header polish; long project titles no longer dominate the screen.",
    ],
  },
  {
    date: "Mid May 2026",
    items: [
      "Model hub with live rankings — pick a model with context, not guesswork.",
      "Bring-your-own-key with per-user encryption, plus two-factor auth and active-session management.",
      "GDPR account deletion and clearer trial limits.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <main className="max-w-2xl mx-auto py-16 px-4">
      <nav className="mb-8">
        <Link href="/" className="text-sm" style={{ color: "var(--brand-green)" }}>← Back</Link>
      </nav>

      <h1 className="text-3xl font-semibold mb-3" style={{ color: "var(--brand-green)" }}>Changelog</h1>
      <p className="mb-10" style={{ color: "var(--ink-3)", fontSize: 15 }}>
        A short, honest log of what we&apos;ve shipped. We build in the open and keep it calm.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {ENTRIES.map((e) => (
          <section key={e.date}>
            <h2 className="mb-3" style={{ color: "var(--ink-1)", fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {e.date}
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {e.items.map((it, i) => (
                <li key={i} style={{ display: "flex", gap: 10, color: "var(--ink-2)", fontSize: 15.5, lineHeight: 1.6 }}>
                  <span aria-hidden style={{ width: 7, height: 7, background: "var(--brand-gold)", transform: "rotate(45deg)", borderRadius: 1, flexShrink: 0, marginTop: 8 }} />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
