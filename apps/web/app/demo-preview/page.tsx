// Demo route for the Goblin Pitch §04 (iPad) iframe (Sprint 10 §B.5). Renders the
// REAL production shell with the Preview view — the real preview chrome (viewport
// switcher + URL bar) framing a static portfolio page — in a read-only demo
// state. See components/demo/DemoApp.tsx. Auth bypass lives in middleware.ts; the
// frame-ancestors override lives in next.config.ts.

import { DemoApp } from "@/components/demo/DemoApp";

export default function DemoPreviewPage() {
  return <DemoApp view="preview" viewport="desktop" />;
}
