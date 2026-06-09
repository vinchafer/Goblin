"use client";

// DemoApp (Sprint 10 §B.4) — renders the REAL production app shell + an active
// view in a read-only "demo" state for the Goblin Pitch device frames (and, later,
// the justgoblin.com landing page). Every visible pixel is the production
// component tree; only the data path is seed-injected and every interactive
// handler is neutralized via demoMode (see docs/DEMO_MODE_ARCHITECTURE.md).
//
//   <DemoApp view="chat"    viewport="mobile"  />  → §04 iPhone / §05 chat
//   <DemoApp view="chat"    viewport="desktop" />
//   <DemoApp view="code"    viewport="desktop" />  → Option β: real shell + real
//                                                     CodeEditor leaf (Navbar.tsx)
//   <DemoApp view="preview" viewport="desktop" />  → real preview chrome + static page

import { useEffect } from "react";
import { Check } from "lucide-react";
import { DemoProviders } from "./DemoProviders";
import { DashboardShell } from "@/components/app-shell/dashboard-shell";
import { StandaloneChat } from "@/components/chat/standalone-chat";
import { PreviewTab } from "@/components/preview/preview-tab";
import { CodeEditor } from "@/components/editor/code-editor";
import { useApp } from "@/contexts/app-context";
import {
  DEMO_PROJECT,
  DEMO_PROJECTS,
  DEMO_USER,
  DEMO_CONVERSATION,
  DEMO_CODE_FILES,
  DEMO_PREVIEW_URL,
  DEMO_PREVIEW_DISPLAY_URL,
} from "@/lib/demo";

export type DemoView = "chat" | "code" | "preview";
export type DemoViewport = "mobile" | "desktop";

export function DemoApp({ view, viewport }: { view: DemoView; viewport: DemoViewport }) {
  return (
    <DemoProviders>
      <DemoInner view={view} viewport={viewport} />
    </DemoProviders>
  );
}

function DemoInner({ view, viewport }: { view: DemoView; viewport: DemoViewport }) {
  const { setActiveTab, setChatProjectId, setPreviewUrl } = useApp();

  // Seed the shell's UI state so the header tabs read as a real, in-project
  // workspace: a project is "active" (Code tab live), a preview exists (Preview
  // tab live), and the correct tab is highlighted for this view. All handlers
  // are inert in demo, so this is purely presentational.
  useEffect(() => {
    setChatProjectId(DEMO_PROJECT.id);
    setPreviewUrl(DEMO_PREVIEW_DISPLAY_URL);
    setActiveTab(view);
  }, [view, setActiveTab, setChatProjectId, setPreviewUrl]);

  return (
    <div data-demo-viewport={viewport} style={{ height: "100dvh", overflow: "hidden" }}>
      <DashboardShell projects={DEMO_PROJECTS} userName={DEMO_USER.user_metadata.name}>
        {view === "chat" && (
          <StandaloneChat
            sessionId="demo"
            initialMessages={DEMO_CONVERSATION}
            projectId={DEMO_PROJECT.id}
          />
        )}
        {view === "code" && <DemoCodeView />}
        {view === "preview" && (
          <PreviewTab
            projectId={DEMO_PROJECT.id}
            previewUrl={DEMO_PREVIEW_URL}
            displayUrl={DEMO_PREVIEW_DISPLAY_URL}
          />
        )}
      </DashboardShell>
    </div>
  );
}

// Option β (DEMO_MODE_ARCHITECTURE.md §"Code-View scope"): the real CodeEditor
// leaf under a lightweight file-tab bar — NOT the deep multi-session
// CodeWorkspace. ~95–99% of the real Code tab's visible pixels at a 4-second
// glance, without seeding 3 brittle code hooks.
function DemoCodeView() {
  const file = DEMO_CODE_FILES[0]!;
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--surface-1)" }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px", background: "var(--surface-2)",
          borderBottom: "1px solid var(--rule)", flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace", fontSize: 13,
            color: "var(--ink-1)", padding: "4px 10px",
            background: "var(--surface-1)", border: "1px solid var(--rule)",
            borderRadius: "6px 6px 0 0",
          }}
        >
          {file.filename}
        </span>
        <span
          style={{
            marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4,
            padding: "3px 10px", borderRadius: 999,
            background: "var(--green-100, rgba(26,58,42,0.10))",
            color: "var(--green-500, #1A3A2A)",
            fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700,
          }}
        >
          <Check size={12} strokeWidth={3} aria-hidden /> Injected
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <CodeEditor content={file.content} filename={file.filename} readOnly theme="light" />
      </div>
    </div>
  );
}
