// Demo route for the Goblin Pitch §04 (MacBook) / §05 iframe (Sprint 10 §B.5).
// Renders the REAL production shell with the Code view (Option β: real CodeEditor
// leaf showing Navbar.tsx) in a read-only demo state. See
// components/demo/DemoApp.tsx. Auth bypass lives in middleware.ts; the
// frame-ancestors override lives in next.config.ts.

import { DemoApp } from "@/components/demo/DemoApp";

export default function DemoCodePage() {
  return <DemoApp view="code" viewport="desktop" />;
}
