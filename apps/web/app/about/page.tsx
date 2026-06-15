"use client";

import Link from "next/link";
import { useLang, t } from "@/lib/use-lang";

// WS-C: was English-only while the app defaults to German. Now bilingual via the
// shared i18n hook (client component — useLang reads the user's lang preference).
export default function AboutPage() {
  const lang = useLang();
  return (
    <main className="max-w-2xl mx-auto py-16 px-4">
      <nav className="mb-8">
        <Link href="/" className="text-sm" style={{ color: "var(--brand-green)" }}>{t(lang, "← Zurück", "← Back")}</Link>
      </nav>

      <h1 className="text-3xl font-semibold mb-8" style={{ color: "var(--brand-green)" }}>{t(lang, "Über uns", "About")}</h1>

      <div style={{ color: "var(--ink-2)", fontSize: 16.5, lineHeight: 1.7 }}>
        {lang === "de" ? (
          <>
            <p className="mb-5">
              Wir bauen Goblin, weil Software-Entwicklung im Web sich ruhig anfühlen sollte,
              nicht überladen. Die meisten Tools erzwingen eine Wahl: ein Chat, der den Code
              nicht anfassen kann, oder eine vollwertige IDE, für die man besser Ingenieur ist.
              Wir wollten den Mittelweg — und wir wollten, dass er vom Handy aus funktioniert.
            </p>
            <p className="mb-5">
              Goblin ist eine Cloud-IDE für Vibe-Coder. Du sprichst mit ihr wie in einem Chat;
              sie schreibt Code, den du lesen, bei Bedarf bearbeiten und veröffentlichen kannst,
              wenn du es wirklich willst. Es gibt eine bewusste Lücke zwischen Entwurf,
              gesicherter Version und etwas live Veröffentlichtem — denn Veröffentlichen sollte
              eine Entscheidung sein, nie ein Reflex.
            </p>
            <p className="mb-5">
              Wir sind ein kleines, unabhängiges Team aus der Schweiz. Wir jagen nicht der
              Feature-Parität mit den lautesten Tools am Markt hinterher. Wir streben nach
              Zurückhaltung: weniger Knöpfe, klarere Wege, ein Produkt, das deine Aufmerksamkeit
              respektiert.
            </p>
            <p>
              Wenn das nachklingt, bist du genau die Person, für die wir bauen.
            </p>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      <div className="mt-10" style={{ borderTop: "1px solid var(--line, rgba(15,43,30,.12))", paddingTop: 20 }}>
        <Link href="/manifesto" className="text-sm" style={{ color: "var(--brand-green)", textDecoration: "underline" }}>
          {t(lang, "Zum Manifest →", "Read the manifesto →")}
        </Link>
      </div>
    </main>
  );
}
