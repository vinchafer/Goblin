"use client";

import { Smartphone, MessageSquare, ArrowRight, Hammer, Github, Rocket, Bell, Globe } from "lucide-react";

interface FlowStep {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  highlight?: boolean;
}

const STEPS: FlowStep[] = [
  { icon: <Smartphone className="w-5 h-5" />, label: "Open Goblin", sub: "Santorini, Greece" },
  { icon: <MessageSquare className="w-5 h-5" />, label: "Chat / Voice" },
  { icon: <ArrowRight className="w-5 h-5" />, label: "Send to Code", highlight: true },
  { icon: <Hammer className="w-5 h-5" />, label: "Build" },
  { icon: <Github className="w-5 h-5" />, label: "GitHub" },
  { icon: <Rocket className="w-5 h-5" />, label: "Vercel", sub: "~34 seconds" },
  { icon: <Bell className="w-5 h-5" />, label: "Push Notif", highlight: true },
  { icon: <Globe className="w-5 h-5" />, label: "Preview" },
];

export function IslandFlow() {
  return (
    <section className="py-24 px-4" style={{ backgroundColor: "#111111" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-3">
          <h2
            className="font-fraunces font-bold text-white"
            style={{ fontSize: "clamp(28px, 5vw, 48px)" }}
          >
            From beach to{" "}
            <em style={{ color: "var(--goblin-ochre)" }}>deployed.</em>
          </h2>
          <p
            className="text-lg max-w-xl mx-auto"
            style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-dm-sans)" }}
          >
            Build your SaaS from a beach. No laptop. No copy-paste. No token panic.
          </p>
        </div>

        {/* Desktop: horizontal row */}
        <div className="hidden md:flex items-center justify-center">
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-center">
              {/* Step */}
              <div className="flex flex-col items-center gap-2 w-28">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200"
                  style={{
                    backgroundColor: step.highlight ? "rgba(201,147,58,0.1)" : "#1e1e1e",
                    border: step.highlight
                      ? "1px solid var(--goblin-ochre)"
                      : "1px solid rgba(255,255,255,0.08)",
                    color: step.highlight ? "var(--goblin-ochre)" : "rgba(255,255,255,0.5)"
                  }}
                >
                  {step.icon}
                </div>
                <span
                  className="text-xs text-center font-medium"
                  style={{
                    color: step.highlight ? "var(--goblin-ochre)" : "rgba(255,255,255,0.5)",
                    fontFamily: "var(--font-dm-sans)"
                  }}
                >
                  {step.label}
                </span>
                {step.sub && (
                  <span
                    className="text-[10px] text-center"
                    style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-dm-sans)" }}
                  >
                    {step.sub}
                  </span>
                )}
              </div>

              {/* Connector */}
              {i < STEPS.length - 1 && (
                <div className="flex items-center mx-1">
                  <div className="h-px w-6" style={{ backgroundColor: "var(--goblin-moss)" }} />
                  <span style={{ color: "var(--goblin-moss)", fontSize: "10px" }}>▶</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Mobile: vertical */}
        <div className="flex md:hidden flex-col items-center gap-0">
          {STEPS.map((step, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="flex items-center gap-4 w-full max-w-xs">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: step.highlight ? "rgba(201,147,58,0.1)" : "#1e1e1e",
                    border: step.highlight
                      ? "1px solid var(--goblin-ochre)"
                      : "1px solid rgba(255,255,255,0.08)",
                    color: step.highlight ? "var(--goblin-ochre)" : "rgba(255,255,255,0.5)"
                  }}
                >
                  {step.icon}
                </div>
                <div>
                  <span
                    className="text-sm font-medium"
                    style={{
                      color: step.highlight ? "var(--goblin-ochre)" : "rgba(255,255,255,0.6)",
                      fontFamily: "var(--font-dm-sans)"
                    }}
                  >
                    {step.label}
                  </span>
                  {step.sub && (
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-dm-sans)" }}
                    >
                      {step.sub}
                    </p>
                  )}
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex flex-col items-center py-1">
                  <div className="w-px h-5" style={{ backgroundColor: "var(--goblin-moss)" }} />
                  <span style={{ color: "var(--goblin-moss)", fontSize: "9px" }}>▼</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <p
          className="text-center mt-12 text-sm"
          style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-dm-sans)" }}
        >
          From idea to live site in under 2 minutes.{" "}
          <span style={{ color: "var(--goblin-ochre)" }}>✦</span> Your goblin handles the rest.
        </p>
      </div>
    </section>
  );
}
