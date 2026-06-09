// Mobile demo route for the Goblin Pitch §04 iPhone iframe (Sprint 10 §B.5).
// Same real production shell + chat view as /demo-chat; the iframe is sized to
// phone width so the shell renders its mobile form (header mode-tile, hidden
// desktop sidebar). See components/demo/DemoApp.tsx. Auth bypass lives in
// middleware.ts; the frame-ancestors override lives in next.config.ts.

import { DemoApp } from "@/components/demo/DemoApp";

export default function DemoChatMobilePage() {
  return <DemoApp view="chat" viewport="mobile" />;
}
