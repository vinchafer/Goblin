"use client";

// Demo route for the Goblin Pitch iframe (Sprint 7 §C). Renders the PRODUCTION
// CodeMirror editor (components/editor/code-editor) read-only with Navbar.tsx
// open + an "Injected" chip — no sessions API, no auth. Used by
// justgoblin.dev/pitch §04 (MacBook) / §05 via <iframe>.

import { Check } from "lucide-react";
import { CodeEditor } from "@/components/editor/code-editor";

const NAVBAR = `// Navbar.tsx
import { useState } from 'react'

export function Navbar() {
  const [dark, setDark] = useState(false)
  const toggle = () => setDark(d => !d)
  return (
    <nav className={dark ? 'dark' : ''}>
      <Toggle onChange={toggle} />
    </nav>
  )
}
`;

export default function DemoCodePage() {
  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-1)",
      }}
    >
      {/* File tab bar + Injected chip — static demo chrome. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--rule)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 13,
            color: "var(--ink-1)",
            padding: "4px 10px",
            background: "var(--surface-1)",
            border: "1px solid var(--rule)",
            borderRadius: "6px 6px 0 0",
          }}
        >
          Navbar.tsx
        </span>
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 10px",
            borderRadius: 999,
            background: "var(--green-100, rgba(26,58,42,0.10))",
            color: "var(--green-500, #1A3A2A)",
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <Check size={12} strokeWidth={3} aria-hidden /> Injected
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <CodeEditor content={NAVBAR} filename="Navbar.tsx" readOnly theme="light" />
      </div>
    </div>
  );
}
