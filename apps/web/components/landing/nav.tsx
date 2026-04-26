"use client";

export function Nav() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-6"
      style={{
        backgroundColor: "rgba(245,240,232,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)"
      }}
    >
      {/* Logo */}
      <a href="/" className="flex items-center">
        <span
          className="font-fraunces text-xl font-bold"
          style={{ color: "var(--goblin-moss)", letterSpacing: "-0.5px" }}
        >
          Goblin<span style={{ color: "var(--goblin-ochre)" }}>.</span>
        </span>
      </a>

      {/* Center links — hidden on mobile */}
      <div className="hidden md:flex items-center gap-8">
        {["Why Goblin", "How it works", "Pricing"].map((label) => (
          <a
            key={label}
            href={`#${label.toLowerCase().replace(/\s+/g, "-")}`}
            className="text-sm font-medium transition-colors"
            style={{ color: "var(--goblin-meta)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--goblin-bark)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--goblin-meta)")}
          >
            {label}
          </a>
        ))}
      </div>

      {/* CTA */}
      <a
        href="/login"
        className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
        style={{ backgroundColor: "var(--goblin-moss)" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--goblin-moss2)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--goblin-moss)")}
      >
        Start building
        <span className="text-xs">→</span>
      </a>
    </nav>
  );
}
