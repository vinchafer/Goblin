// Demo route for the Goblin Pitch §05 iframe (Sprint 10 §B.5). Renders the REAL
// production app shell (Header + Sidebar + tab bar) with the chat view in a
// read-only demo state — see components/demo/DemoApp.tsx. Auth bypass lives in
// middleware.ts; the frame-ancestors override lives in next.config.ts.

import { DemoApp } from "@/components/demo/DemoApp";

export default function DemoChatPage() {
  return <DemoApp view="chat" viewport="desktop" />;
}
