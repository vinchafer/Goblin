// Demo route for the Goblin Pitch §05 iframe (Sprint 10 §B.5). Renders the REAL
// production app shell (Header + Sidebar + tab bar) with the chat view in a
// read-only demo state — see components/demo/DemoApp.tsx. Auth bypass lives in
// middleware.ts; the frame-ancestors override lives in next.config.ts.

import { DemoApp } from "@/components/demo/DemoApp";

// Force dynamic rendering so this route is never statically prerendered at
// build time (where NEXT_PUBLIC_* build env may be absent). See README build
// env contract.
export const dynamic = "force-dynamic";

export default function DemoChatPage() {
  return <DemoApp view="chat" viewport="desktop" />;
}
