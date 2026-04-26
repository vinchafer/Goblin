export function TheProblem() {
  const problems = [
    {
      emoji: "⚡",
      title: "Token panic",
      description: "Claude Pro locks you out after 2 hours. Mid-flow."
    },
    {
      emoji: "💻",
      title: "Hardware wall",
      description: "Running powerful models needs 48GB+ VRAM. Most don't have that."
    },
    {
      emoji: "📋",
      title: "Copy-paste hell",
      description: "Chat → copy → switch → paste. Every. Single. Time."
    },
    {
      emoji: "🔩",
      title: "IDE overwhelm",
      description: "Cursor wasn't built for builders who just want to ship."
    }
  ];

  return (
    <section
      id="why-goblin"
      className="py-24 px-4"
      style={{ backgroundColor: "var(--goblin-moss)" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-3">
          <p
            className="text-sm font-medium tracking-widest uppercase"
            style={{
              color: "var(--goblin-ochre)",
              fontFamily: "var(--font-dm-sans)"
            }}
          >
            The problem
          </p>
          <h2
            className="font-fraunces font-bold text-white"
            style={{ fontSize: "clamp(28px, 5vw, 48px)" }}
          >
            Building with AI shouldn&apos;t feel like this.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {problems.map((p, i) => (
            <div
              key={i}
              className="p-6 rounded-xl transition-all duration-200"
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)"
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(201,147,58,0.3)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)";
              }}
            >
              <div className="text-3xl mb-4">{p.emoji}</div>
              <h3
                className="font-semibold text-white mb-2"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                {p.title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontFamily: "var(--font-dm-sans)"
                }}
              >
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
