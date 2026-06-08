// The demo conversation — the Sprint 4 "dark mode toggle" exchange. Structurally
// mirrors StandaloneChat's message shape (id, role, content, has_code,
// created_at, model_used?, source_tier?) so it's assignable to
// StandaloneChat's `initialMessages` prop. Kept as a local interface to avoid
// importing a non-exported type; structural typing handles assignability.

export interface DemoMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  has_code: boolean;
  created_at: string;
  model_used?: string;
  source_tier?: string;
}

const NOW = "2026-06-07T09:00:00.000Z";

export const DEMO_CONVERSATION: DemoMessage[] = [
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
