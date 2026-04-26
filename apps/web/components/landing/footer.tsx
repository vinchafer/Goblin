import Link from "next/link";

export function Footer() {
  return (
    <footer className="py-16 px-4" style={{ backgroundColor: "var(--goblin-moss)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <h3
              className="font-fraunces font-bold text-2xl mb-2"
              style={{ color: "var(--goblin-ochre)" }}
            >
              Goblin.
            </h3>
            <p
              className="text-sm leading-relaxed"
              style={{
                color: "rgba(255,255,255,0.45)",
                fontFamily: "var(--font-dm-sans)"
              }}
            >
              The cloud workshop for builders.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4
              className="text-xs font-medium uppercase tracking-widest mb-4"
              style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-dm-sans)" }}
            >
              Product
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: "Pricing", href: "/#pricing" },
                { label: "How it works", href: "/#how-it-works" },
                { label: "Changelog", href: "/changelog" },
              ].map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm transition-colors"
                    style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-dm-sans)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community */}
          <div>
            <h4
              className="text-xs font-medium uppercase tracking-widest mb-4"
              style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-dm-sans)" }}
            >
              Community
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: "Discord", href: "https://discord.gg/goblin" },
                { label: "GitHub", href: "https://github.com/goblin-dev" },
                { label: "Twitter", href: "https://twitter.com/goblin_dev" },
              ].map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-sm transition-colors"
                    style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-dm-sans)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4
              className="text-xs font-medium uppercase tracking-widest mb-4"
              style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-dm-sans)" }}
            >
              Legal
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: "Terms", href: "/terms" },
                { label: "Privacy", href: "/privacy" },
                { label: "Imprint", href: "/imprint" },
              ].map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm transition-colors"
                    style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-dm-sans)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          className="pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-xs"
          style={{
            borderColor: "rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.3)",
            fontFamily: "var(--font-dm-sans)"
          }}
        >
          <span>© 2026 Goblin. All rights reserved.</span>
          <span>Built with a goblin 👺</span>
        </div>
      </div>
    </footer>
  );
}
