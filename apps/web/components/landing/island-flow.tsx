"use client";

import { Smartphone, MessageSquare, ArrowRight, Hammer, Github, Rocket, Bell, Globe } from "lucide-react";

interface FlowStep {
  icon: React.ReactNode;
  label: string;
  highlight?: boolean;
}

export function IslandFlow() {
  const steps: FlowStep[] = [
    { icon: <Smartphone className="w-5 h-5" />, label: "Open Goblin" },
    { icon: <MessageSquare className="w-5 h-5" />, label: "Chat or Voice" },
    { icon: <ArrowRight className="w-5 h-5" />, label: "Send to Code", highlight: true },
    { icon: <Hammer className="w-5 h-5" />, label: "Build" },
    { icon: <Github className="w-5 h-5" />, label: "Push to GitHub" },
    { icon: <Rocket className="w-5 h-5" />, label: "Vercel Deploy" },
    { icon: <Bell className="w-5 h-5" />, label: "Push Notification", highlight: true },
    { icon: <Globe className="w-5 h-5" />, label: "Preview" },
  ];

  return (
    <section className="py-24 px-4" style={{ backgroundColor: '#111' }}>
      <div className="max-w-6xl mx-auto">
        {/* Headline */}
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-4xl font-semibold" style={{ color: '#fff' }}>
            The Island Flow
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: '#999' }}>
            Build your SaaS from a beach in Santorini.
            <br />
            No laptop. No copy-paste. No token panic.
          </p>
        </div>

        {/* Flow steps — horizontal on desktop, vertical on mobile */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-0 md:gap-0">
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col md:flex-row items-center w-full md:w-auto">
              {/* Step card */}
              <div className="flex flex-col items-center gap-3 p-4 w-full md:w-32">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300"
                  style={{
                    backgroundColor: step.highlight ? 'var(--goblin-ochre)' : '#222',
                    color: step.highlight ? '#111' : '#888',
                    boxShadow: step.highlight ? '0 0 20px rgba(212, 169, 74, 0.3)' : 'none',
                  }}
                >
                  {step.icon}
                </div>
                <span
                  className="text-xs text-center font-medium leading-tight"
                  style={{
                    color: step.highlight ? 'var(--goblin-ochre)' : '#888',
                  }}
                >
                  {step.label}
                </span>
                {step.highlight && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{ backgroundColor: 'var(--goblin-ochre)', color: '#111' }}
                  >
                    ★
                  </span>
                )}
              </div>

              {/* Connector arrow (not after last step) */}
              {i < steps.length - 1 && (
                <div className="flex items-center justify-center py-2 md:py-0 md:px-1">
                  {/* Vertical arrow on mobile, horizontal on desktop */}
                  <div className="md:hidden flex flex-col items-center gap-0">
                    <div className="w-0.5 h-6" style={{ backgroundColor: 'var(--goblin-moss)' }} />
                    <div style={{ color: 'var(--goblin-moss)', fontSize: '10px' }}>▼</div>
                  </div>
                  <div className="hidden md:flex items-center gap-0">
                    <div className="h-0.5 w-8" style={{ backgroundColor: 'var(--goblin-moss)' }} />
                    <div style={{ color: 'var(--goblin-moss)', fontSize: '10px' }}>▶</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom caption */}
        <div className="text-center mt-16">
          <p className="text-sm" style={{ color: '#666' }}>
            From idea to live site in under 2 minutes.
            <br />
            <span style={{ color: 'var(--goblin-ochre)' }}>✦</span> Your goblin handles the rest.
          </p>
        </div>
      </div>
    </section>
  );
}