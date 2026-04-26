"use client";

export function Hero() {
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-14"
      style={{ backgroundColor: "var(--goblin-cream)" }}
    >
      {/* Background grid + radial moss glow */}
      <div className="absolute inset-0 goblin-grid-pattern pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(30,58,28,0.07) 0%, transparent 70%)"
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8">
        {/* Eyebrow badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-medium"
          style={{
            borderColor: "var(--goblin-ochre)",
            color: "var(--goblin-ochre)",
            backgroundColor: "rgba(201,147,58,0.06)"
          }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse-dot"
            style={{ backgroundColor: "#22c55e" }}
          />
          Now in beta
        </div>

        {/* H1 */}
        <h1
          className="font-fraunces font-bold leading-[0.9] tracking-[-3px]"
          style={{
            fontSize: "clamp(52px, 10vw, 88px)",
            color: "var(--goblin-bark)"
          }}
        >
          Build from
          <br />
          <em
            className="not-italic"
            style={{ color: "var(--goblin-ochre)", fontStyle: "italic" }}
          >
            anywhere.
          </em>
          <br />
          Ship everything.
        </h1>

        {/* Subtext */}
        <p
          className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
          style={{ color: "var(--goblin-meta)", fontFamily: "var(--font-dm-sans)" }}
        >
          Your AI workshop in the cloud. No token panic. No laptop limits.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <a
            href="/login"
            className="w-full sm:w-auto px-7 py-3 rounded-lg font-medium text-white text-center transition-colors"
            style={{ backgroundColor: "var(--goblin-moss)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--goblin-moss2)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--goblin-moss)")}
          >
            Start building free →
          </a>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto px-7 py-3 rounded-lg font-medium text-center border transition-colors"
            style={{
              color: "var(--goblin-moss)",
              borderColor: "var(--goblin-border)"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--goblin-moss)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--goblin-border)")}
          >
            See how it works
          </a>
        </div>

        {/* Trust line */}
        <p
          className="text-sm"
          style={{
            color: "var(--goblin-meta)",
            fontFamily: "var(--font-dm-sans)"
          }}
        >
          Fair-use unlimited inference · BYOK support · GitHub push built-in
        </p>

        {/* App window mockup */}
        <div className="mt-8 rounded-2xl overflow-hidden shadow-2xl border max-w-4xl mx-auto"
          style={{ borderColor: "var(--goblin-border)" }}
        >
          {/* Chrome bar */}
          <div
            className="h-9 flex items-center gap-2 px-4 border-b"
            style={{
              backgroundColor: "var(--goblin-moss)",
              borderColor: "rgba(255,255,255,0.1)"
            }}
          >
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#ff5f57" }} />
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#febc2e" }} />
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#28c840" }} />
            </div>
            <div
              className="flex-1 mx-4 h-5 rounded text-xs flex items-center justify-center"
              style={{
                backgroundColor: "rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.5)",
                fontFamily: "var(--font-jetbrains-mono)"
              }}
            >
              app.goblin.dev
            </div>
          </div>

          {/* 3-panel dashboard preview */}
          <div
            className="flex"
            style={{ backgroundColor: "var(--goblin-cream2)", minHeight: "260px" }}
          >
            {/* Sidebar strip */}
            <div
              className="w-44 border-r flex flex-col gap-1 p-2"
              style={{
                backgroundColor: "var(--goblin-cream)",
                borderColor: "var(--goblin-border)"
              }}
            >
              <div
                className="h-7 rounded-md flex items-center px-2 text-xs font-medium text-white"
                style={{ backgroundColor: "var(--goblin-moss)" }}
              >
                + New Project
              </div>
              {["my-saas", "portfolio", "api-server"].map((p, i) => (
                <div
                  key={p}
                  className="h-7 rounded-md flex items-center gap-2 px-2 text-xs"
                  style={{
                    backgroundColor: i === 0 ? "rgba(201,147,58,0.1)" : "transparent",
                    color: i === 0 ? "var(--goblin-ochre)" : "var(--goblin-meta)",
                    border: i === 0 ? "1px solid rgba(201,147,58,0.2)" : "none"
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: ["var(--goblin-ochre)", "#22c55e", "var(--goblin-meta)"][i]
                    }}
                  />
                  {p}
                </div>
              ))}
            </div>

            {/* Chat panel */}
            <div className="flex-1 flex flex-col p-3 gap-2">
              <div
                className="self-end max-w-[70%] px-3 py-1.5 rounded-2xl rounded-br-md text-xs text-white"
                style={{ backgroundColor: "var(--goblin-moss)" }}
              >
                Add a navbar with dark mode
              </div>
              <div
                className="self-start max-w-[80%] px-3 py-2 rounded-2xl rounded-bl-md text-xs border"
                style={{
                  backgroundColor: "var(--goblin-cream)",
                  borderColor: "var(--goblin-border)",
                  color: "var(--goblin-bark)"
                }}
              >
                Here&apos;s the component with a toggle built in...
                <div
                  className="mt-2 px-2 py-1 rounded text-[10px] font-mono"
                  style={{ backgroundColor: "#1a2018", color: "#7aaa75" }}
                >
                  export function Navbar() &#123;...&#125;
                </div>
                <button
                  className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium text-white"
                  style={{ backgroundColor: "var(--goblin-ochre)" }}
                >
                  → Send to Code
                </button>
              </div>
            </div>

            {/* Code panel */}
            <div
              className="w-52 border-l p-3"
              style={{
                backgroundColor: "#141a12",
                borderColor: "rgba(255,255,255,0.08)"
              }}
            >
              <div
                className="text-[10px] mb-2 pb-1 border-b"
                style={{
                  color: "rgba(255,255,255,0.4)",
                  borderColor: "rgba(255,255,255,0.08)",
                  fontFamily: "var(--font-jetbrains-mono)"
                }}
              >
                Navbar.tsx
              </div>
              <div
                className="text-[10px] leading-relaxed"
                style={{ color: "#7aaa75", fontFamily: "var(--font-jetbrains-mono)" }}
              >
                <span style={{ color: "#c9933a" }}>import</span> &#123; useState &#125;<br />
                <span style={{ color: "#c9933a" }}>export function</span> Navbar() &#123;<br />
                &nbsp;&nbsp;<span style={{ color: "rgba(255,255,255,0.4)" }}>// dark mode</span><br />
                &nbsp;&nbsp;<span style={{ color: "#c9933a" }}>const</span> [dark] = ...<br />
                &#125;
              </div>
              <div
                className="mt-3 px-2 py-1 rounded text-[10px] border animate-fade-in"
                style={{
                  borderColor: "var(--goblin-ochre)",
                  color: "var(--goblin-ochre)",
                  fontFamily: "var(--font-jetbrains-mono)"
                }}
              >
                ✦ Injected
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
