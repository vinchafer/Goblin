"use client";

// Mobile demo route for the Goblin Pitch §04 iPhone iframe (Sprint 8 §D.1).
// Same production chat leaf + pre-seeded "dark mode toggle" conversation as
// /demo-chat, but the viewport is forced to phone width (≤390px) so the chat
// renders in its mobile form (narrower bubbles, tighter rhythm) regardless of
// the host iframe's own width. No auth, no API — auth bypass lives in
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

export default function DemoChatMobilePage() {
  return (
    <div
      className="demo-mobile"
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "var(--bone)",
      }}
    >
      {/* Phone-width column — forces the mobile chat rendering. */}
      <div
        className="chat-scroll"
        style={{
          gap: 14,
          flex: 1,
          width: "100%",
          maxWidth: 390,
          padding: "16px 14px",
        }}
      >
        {MESSAGES.map((m) => (
          <Message key={m.id} msg={m} isStreaming={false} />
        ))}
      </div>
    </div>
  );
}
