"use client";

// Demo route for the Goblin Pitch iframe (Sprint 7 §C). Renders a static
// portfolio page — what a builder shipped with Goblin — as the Preview surface
// content. No auth, no deploy. Used by justgoblin.dev/pitch §04 (iPad) via
// <iframe>. Mirrors the Sprint-6 iPad mock so live + fallback look identical.

export default function DemoPreviewPage() {
  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-0, #fff)",
        fontFamily: "var(--font-sans)",
        color: "var(--ink-deep)",
        overflow: "hidden",
      }}
    >
      {/* nav */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 28px",
          background: "var(--brand-green, #1A3A2A)",
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "var(--brand-gold, #D4A737)",
          }}
        />
        <span
          style={{
            display: "flex",
            gap: 22,
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 14,
            color: "rgba(247,247,236,0.85)",
          }}
        >
          <span>Home</span>
          <span>About</span>
          <span>Work</span>
        </span>
      </div>

      {/* hero */}
      <div style={{ padding: "44px 28px 0" }}>
        <h1 style={{ margin: 0, fontSize: 38, fontWeight: 700, letterSpacing: "-0.01em" }}>
          Welcome to my portfolio.
        </h1>
        <p style={{ margin: "10px 0 0", fontSize: 18, color: "var(--ink-2, #3F3A2C)" }}>
          Designer, builder, ships things.
        </p>
        <span
          style={{
            display: "inline-flex",
            marginTop: 20,
            padding: "12px 22px",
            borderRadius: 10,
            background: "var(--brand-gold, #D4A737)",
            color: "var(--ink-deep, #0F2B1E)",
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          Get in touch →
        </span>
      </div>

      {/* image */}
      <div
        style={{
          margin: "32px 28px 0",
          height: 150,
          borderRadius: 14,
          background:
            "radial-gradient(circle, rgba(15,43,30,0.14) 1.4px, transparent 1.5px) 0 0 / 22px 22px, linear-gradient(135deg, #DDEAE0, #C2D8C9)",
        }}
      />

      {/* two-column */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 36,
          padding: "32px 28px 0",
        }}
      >
        {(["Selected work", "About me"] as const).map((h) => (
          <div key={h}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{h}</div>
            {[100, 100, 100, 60].map((w, i) => (
              <div
                key={i}
                style={{
                  height: 9,
                  width: `${w}%`,
                  borderRadius: 999,
                  background: "var(--rule, #D8CBA8)",
                  marginBottom: 9,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* footer */}
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 28px",
          borderTop: "1px solid var(--rule, #D8CBA8)",
        }}
      >
        <span style={{ display: "flex", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: "var(--rule-strong, #B8A988)",
              }}
            />
          ))}
        </span>
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 13,
            color: "var(--ink-3, #74694F)",
          }}
        >
          © 2026
        </span>
      </div>
    </div>
  );
}
