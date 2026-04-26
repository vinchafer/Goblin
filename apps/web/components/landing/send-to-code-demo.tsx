"use client";

import { useState, useCallback } from "react";
import { ArrowRight, Check, Send } from "lucide-react";

type DemoState = "idle" | "sending" | "sent";

export function SendToCodeDemo() {
  const [state, setState] = useState<DemoState>("idle");

  const handleSend = useCallback(() => {
    if (state !== "idle") return;
    setState("sending");
    setTimeout(() => {
      setState("sent");
    }, 400);
  }, [state]);

  const handleReset = useCallback(() => {
    setState("idle");
  }, []);

  return (
    <section className="py-24 px-4" style={{ backgroundColor: 'var(--goblin-cream)' }}>
      <div className="max-w-6xl mx-auto">
        {/* Headline */}
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-4xl font-semibold" style={{ color: 'var(--goblin-slate)' }}>
            No more copy-paste.
            <br />
            One tap. Code in editor.
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--goblin-gray)' }}>
            Every AI response with code gets a [→ Send to Code] button.
            Tap it. Done. Your goblin handles the rest.
          </p>
        </div>

        {/* Two-column demo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Chat Interface Mockup */}
          <div className="rounded-2xl border overflow-hidden shadow-lg" style={{ borderColor: 'var(--goblin-light)', backgroundColor: '#fff' }}>
            {/* Chat header */}
            <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--goblin-light)' }}>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#EF4444' }} />
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10B981' }} />
              <span className="ml-2 text-xs font-medium" style={{ color: 'var(--goblin-gray)' }}>Goblin Chat</span>
            </div>

            {/* Chat messages */}
            <div className="p-4 space-y-4 min-h-[420px]">
              {/* User message */}
              <div className="flex justify-end">
                <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md" style={{ backgroundColor: 'var(--goblin-moss)', color: '#fff' }}>
                  <p className="text-sm">Add a dark mode toggle to the navbar</p>
                </div>
              </div>

              {/* AI response */}
              <div className="flex justify-start">
                <div className="max-w-[90%] space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: 'var(--goblin-ochre)', color: '#fff' }}>G</div>
                    <span className="text-xs font-medium" style={{ color: 'var(--goblin-gray)' }}>Goblin</span>
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-bl-md text-sm" style={{ backgroundColor: 'var(--goblin-light)', color: 'var(--goblin-slate)' }}>
                    <p className="mb-2">Here's how to add a dark mode toggle to your navbar:</p>
                    <div className="rounded-lg p-3 text-xs font-mono overflow-x-auto" style={{ backgroundColor: 'var(--goblin-slate)', color: '#E2E8F0' }}>
                      <div><span style={{ color: '#F472B6' }}>import</span> {"{ useState }"} <span style={{ color: '#F472B6' }}>from</span> <span style={{ color: '#A5D6A7' }}>"react"</span>;</div>
                      <div className="mt-1"><span style={{ color: '#F472B6' }}>export function</span> <span style={{ color: '#82B1FF' }}>Navbar</span>() {"{"}</div>
                      <div className="ml-4"><span style={{ color: '#F472B6' }}>const</span> [dark, setDark] = <span style={{ color: '#82B1FF' }}>useState</span>(<span style={{ color: '#F78C6C' }}>false</span>);</div>
                      <div className="mt-1 ml-4"><span style={{ color: '#F472B6' }}>return</span> (</div>
                      <div className="ml-6">{'<nav className={dark ? "bg-gray-900" : "bg-white"}>'}</div>
                      <div className="ml-8">{'<button onClick={() => setDark(!dark)}>'}</div>
                      <div className="ml-10">{'{dark ? "☀️" : "🌙"}'}</div>
                      <div className="ml-8">{'</button>'}</div>
                      <div className="ml-6">{'</nav>'}</div>
                      <div className="ml-4">);</div>
                      <div>{"}"}</div>
                    </div>
                  </div>

                  {/* Send to Code button */}
                  <button
                    onClick={state === "idle" ? handleSend : handleReset}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300"
                    style={{
                      backgroundColor: state === "sent" ? 'var(--goblin-moss)' : 'var(--goblin-ochre)',
                      color: '#fff',
                      cursor: state === "sending" ? 'wait' : 'pointer',
                      opacity: state === "sending" ? 0.8 : 1,
                    }}
                  >
                    {state === "idle" && (
                      <>
                        <ArrowRight className="w-4 h-4" />
                        Send to Code
                      </>
                    )}
                    {state === "sending" && (
                      <>
                        <Send className="w-4 h-4 animate-pulse" />
                        Sending...
                      </>
                    )}
                    {state === "sent" && (
                      <>
                        <Check className="w-4 h-4" />
                        Sent
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Code Editor Mockup */}
          <div className="rounded-2xl border overflow-hidden shadow-lg" style={{ borderColor: 'var(--goblin-light)', backgroundColor: 'var(--goblin-slate)' }}>
            {/* Editor header */}
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#444' }}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#EF4444' }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10B981' }} />
              </div>
              <span className="text-xs" style={{ color: '#888' }}>Navbar.tsx</span>
            </div>

            {/* Editor content */}
            <div className="p-4 min-h-[420px]">
              {state === "idle" && (
                <div className="flex items-center justify-center h-full min-h-[380px]">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: '#333' }}>
                      <ArrowRight className="w-8 h-8" style={{ color: 'var(--goblin-ochre)' }} />
                    </div>
                    <p className="text-sm" style={{ color: '#666' }}>
                      Tap "Send to Code" to inject
                    </p>
                  </div>
                </div>
              )}

              {(state === "sending" || state === "sent") && (
                <div
                  className="transition-all duration-500"
                  style={{
                    opacity: state === "sent" ? 1 : 0,
                    transform: state === "sent" ? 'translateY(0)' : 'translateY(20px)',
                  }}
                >
                  <div className="rounded-lg p-3 text-xs font-mono overflow-x-auto" style={{ backgroundColor: '#1E1E1E', color: '#E2E8F0' }}>
                    <div><span style={{ color: '#F472B6' }}>import</span> {"{ useState }"} <span style={{ color: '#F472B6' }}>from</span> <span style={{ color: '#A5D6A7' }}>"react"</span>;</div>
                    <div className="mt-2"><span style={{ color: '#F472B6' }}>export function</span> <span style={{ color: '#82B1FF' }}>Navbar</span>() {"{"}</div>
                    <div className="ml-4"><span style={{ color: '#F472B6' }}>const</span> [dark, setDark] = <span style={{ color: '#82B1FF' }}>useState</span>(<span style={{ color: '#F78C6C' }}>false</span>);</div>
                    <div className="mt-2 ml-4"><span style={{ color: '#F472B6' }}>return</span> (</div>
                    <div className="ml-6">{'<nav className={dark ? "bg-gray-900" : "bg-white"}>'}</div>
                    <div className="ml-8">{'<button onClick={() => setDark(!dark)}>'}</div>
                    <div className="ml-10">{'{dark ? "☀️" : "🌙"}'}</div>
                    <div className="ml-8">{'</button>'}</div>
                    <div className="ml-6">{'</nav>'}</div>
                    <div className="ml-4">);</div>
                    <div>{"}"}</div>
                  </div>

                  {/* Ochre badge */}
                  {state === "sent" && (
                    <div
                      className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium animate-fade-in"
                      style={{ backgroundColor: 'var(--goblin-ochre)', color: '#fff' }}
                    >
                      <span>✦</span>
                      Injected via Send to Code
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
