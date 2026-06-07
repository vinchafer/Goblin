"use client";

// Demo route for the Goblin Pitch iframe (Sprint 7 §C). Renders the PRODUCTION
// chat leaf component (components/chat/Message) with a pre-seeded, read-only
// "dark mode toggle" conversation — no auth, no API, no streaming shell. Used by
// justgoblin.dev/pitch §05 (and §04 iPhone) via <iframe>. Auth bypass lives in
// middleware.ts; the frame-ancestors override lives in next.config.ts.

import Message, { type StandaloneMessage } from "@/components/chat/Message";

const NOW = "2026-06-07T09:00:00.000Z";

const MESSAGES: (StandaloneMessage & { id: string })[] = [
  {
    id: "u1",
    role: "user",
    content: "Add a dark mode toggle to the navbar",
    has_code: false,
    created_at: NOW,
  },
  {
    id: "a1",
    role: "assistant",
    content:
      "Here's your updated component:\n\n```tsx\nexport function Navbar() {\n  const [dark, setDark] = useState(false)\n  const toggle = () => setDark(d => !d)\n  return (\n    <nav className={dark ? 'dark' : ''}>\n      <Toggle onChange={toggle} />\n    </nav>\n  )\n}\n```",
    has_code: true,
    created_at: NOW,
    model_used: "llama-3.3-70b",
    source_tier: "goblin_hosted",
  },
];

export default function DemoChatPage() {
  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bone)",
      }}
    >
      <div className="chat-scroll" style={{ gap: 16, flex: 1 }}>
        {MESSAGES.map((m) => (
          <Message key={m.id} msg={m} isStreaming={false} />
        ))}
      </div>
    </div>
  );
}
