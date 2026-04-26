"use client";

import { useState, useCallback, useEffect } from "react";
import { Check, ArrowRight, Send } from "lucide-react";

type DemoState = "idle" | "sending" | "sent";

export function SendToCodeDemo() {
  const [state, setState] = useState<DemoState>("idle");

  const handleSend = useCallback(() => {
    if (state !== "idle") return;
    setState("sending");
    setTimeout(() => setState("sent"), 300);
  }, [state]);

  useEffect(() => {
    if (state !== "sent") return;
    const t = setTimeout(() => setState("idle"), 5000);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <section
      id="how-it-works"
      className="py-24 px-4"
      style={{ backgroundColor: "var(--goblin-cream)" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2
            className="font-fraunces font-bold"
            style={{
              fontSize: "clamp(28px, 5vw, 48px)",
              color: "var(--goblin-moss)"
            }}
          >
            No more copy-paste.
          </h2>
          <p
            className="text-lg max-w-2xl mx-auto"
            style={{
              color: "var(--goblin-meta)",
              fontFamily: "var(--font-dm-sans)"
            }}
          >
            One tap sends AI code directly to your editor.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT — Chat mockup */}
          <div
            className="rounded-2xl overflow-hidden shadow-lg border"
            style={{ borderColor: "var(--goblin-border)", backgroundColor: "#fff" }}
          >
            {/* Topbar */}
            <div
              className="h-10 px-4 flex items-center gap-2 border-b"
              style={{
                backgroundColor: "var(--goblin-moss)",
                borderColor: "rgba(255,255,255,0.1)"
              }}
            >
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ff5f57" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#febc2e" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#28c840" }} />
              </div>
              <span
                className="ml-2 text-xs text-white/60"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                Goblin Chat
              </span>
            </div>

            {/* Messages */}
            <div className="p-5 space-y-4 min-h-[400px]">
              {/* User bubble */}
              <div className="flex justify-end">
                <div
                  className="max-w-[78%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm text-white"
                  style={{ backgroundColor: "var(--goblin-moss)" }}
                >
                  Add a dark mode toggle to the navbar
                </div>
              </div>

              {/* AI response */}
              <div className="flex justify-start">
                <div className="max-w-[90%] space-y-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: "var(--goblin-ochre)" }}
                    >
                      G
                    </div>
                    <span
                      className="text-xs"
                      style={{ color: "var(--goblin-meta)", fontFamily: "var(--font-dm-sans)" }}
                    >
                      Goblin
                    </span>
                  </div>

                  <div
                    className="px-4 py-3 rounded-2xl rounded-bl-md text-sm border"
                    style={{
                      backgroundColor: "var(--goblin-cream2)",
                      borderColor: "var(--goblin-border)",
                      color: "var(--goblin-bark)"
                    }}
                  >
                    <p className="mb-3" style={{ fontFamily: "var(--font-dm-sans)" }}>
                      Here&apos;s how to add a dark mode toggle:
                    </p>
                    <div
                      className="rounded-lg p-3 text-xs overflow-x-auto"
                      style={{
                        backgroundColor: "#1a2018",
                        color: "#7aaa75",
                        fontFamily: "var(--font-jetbrains-mono)"
                      }}
                    >
                      <div><span style={{ color: "#c9933a" }}>import</span> {`{ useState }`} <span style={{ color: "#c9933a" }}>from</span> <span style={{ color: "#7aaa75" }}>&quot;react&quot;</span>;</div>
                      <div className="mt-1"><span style={{ color: "#c9933a" }}>export function</span> <span style={{ color: "#82B1FF" }}>Navbar</span>() {"{"}</div>
                      <div className="ml-4"><span style={{ color: "#c9933a" }}>const</span> [dark, setDark] = <span style={{ color: "#82B1FF" }}>useState</span>(<span style={{ color: "#F78C6C" }}>false</span>);</div>
                      <div className="mt-1 ml-4"><span style={{ color: "#c9933a" }}>return</span> {"<nav>"} ...</div>
                      <div>{"}"}</div>
                    </div>
                  </div>

                  {/* Send to Code button */}
                  <button
                    onClick={handleSend}
                    disabled={state === "sending"}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all duration-300"
                    style={{
                      backgroundColor:
                        state === "sent"
                          ? "#16a34a"
                          : "var(--goblin-ochre)",
                      opacity: state === "sending" ? 0.75 : 1,
                      cursor: state === "sending" ? "wait" : "pointer",
                      fontFamily: "var(--font-dm-sans)"
                    }}
                  >
                    {state === "idle" && <><ArrowRight className="w-4 h-4" /> → Send to Code</>}
                    {state === "sending" && <><Send className="w-4 h-4 animate-pulse" /> Sending...</>}
                    {state === "sent" && <><Check className="w-4 h-4" /> ✓ Sent to Code</>}
                  </button>
                </div>
              </div>

              {/* Injection banner */}
              {state === "sent" && (
                <div
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border animate-fade-in"
                  style={{
                    borderColor: "var(--goblin-ochre)",
                    backgroundColor: "rgba(201,147,58,0.06)",
                    color: "var(--goblin-ochre)",
                    fontFamily: "var(--font-jetbrains-mono)"
                  }}
                >
                  <span>✦</span>
                  <span className="text-xs">Injected via Send to Code · Navbar.tsx</span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Code editor */}
          <div
            className="rounded-2xl overflow-hidden shadow-lg border"
            style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "#141a12" }}
          >
            <div
              className="h-10 px-4 flex items-center justify-between border-b"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ff5f57" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#febc2e" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#28c840" }} />
              </div>
              <span
                className="text-xs"
                style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-jetbrains-mono)" }}
              >
                Navbar.tsx
              </span>
              <div />
            </div>

            <div className="p-5 min-h-[400px]">
              {state === "idle" && (
                <div className="flex items-center justify-center h-full min-h-[360px]">
                  <div className="text-center space-y-3">
                    <div
                      className="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                    >
                      <ArrowRight className="w-7 h-7" style={{ color: "var(--goblin-ochre)" }} />
                    </div>
                    <p
                      className="text-sm"
                      style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-dm-sans)" }}
                    >
                      Tap &ldquo;Send to Code&rdquo; to inject
                    </p>
                  </div>
                </div>
              )}

              {(state === "sending" || state === "sent") && (
                <div
                  className="transition-all duration-500"
                  style={{
                    opacity: state === "sent" ? 1 : 0,
                    transform: state === "sent" ? "translateX(0)" : "translateX(24px)"
                  }}
                >
                  {/* Line numbers + code */}
                  <div className="flex text-xs" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                    {/* Gutter */}
                    <div
                      className="pr-4 text-right select-none space-y-1"
                      style={{ color: "rgba(255,255,255,0.2)", minWidth: "2rem" }}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <div key={n}>{n}</div>
                      ))}
                    </div>
                    {/* Code lines — injected lines get ochre left border */}
                    <div className="flex-1 space-y-1">
                      {[
                        { code: <><span style={{ color: "#c9933a" }}>import</span>{` { useState } from `}<span style={{ color: "#7aaa75" }}>&quot;react&quot;</span>;</>, inject: false },
                        { code: "", inject: false },
                        { code: <><span style={{ color: "#c9933a" }}>export function</span> <span style={{ color: "#82B1FF" }}>Navbar</span>() {"{"}</>, inject: false },
                        { code: <>&nbsp;&nbsp;<span style={{ color: "#c9933a" }}>const</span> [dark, setDark] = useState(<span style={{ color: "#F78C6C" }}>false</span>);</>, inject: true },
                        { code: <>&nbsp;&nbsp;<span style={{ color: "#c9933a" }}>return</span> (</>, inject: true },
                        { code: <>&nbsp;&nbsp;&nbsp;&nbsp;{`<nav className={dark ? "bg-gray-900" : "bg-white"}>`}</>, inject: true },
                        { code: <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{`<button onClick={() => setDark(!dark)}>`}</>, inject: true },
                        { code: <>{"    }"}</>, inject: false },
                      ].map((line, i) => (
                        <div
                          key={i}
                          className="pl-3"
                          style={{
                            color: "#7aaa75",
                            borderLeft: line.inject
                              ? "2px solid var(--goblin-ochre)"
                              : "2px solid transparent",
                            backgroundColor: line.inject
                              ? "rgba(201,147,58,0.06)"
                              : "transparent"
                          }}
                        >
                          {line.code}
                        </div>
                      ))}
                    </div>
                  </div>

                  {state === "sent" && (
                    <div
                      className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border animate-slide-in-right"
                      style={{
                        borderColor: "var(--goblin-ochre)",
                        color: "var(--goblin-ochre)",
                        backgroundColor: "rgba(201,147,58,0.1)",
                        fontFamily: "var(--font-jetbrains-mono)"
                      }}
                    >
                      <span>✦</span>
                      Injected via Send to Code · Navbar.tsx
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
