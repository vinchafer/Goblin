"use client";

import { useEffect, useRef, useState } from "react";
import { CodeTabClassic } from "./code-tab-classic";
import { CodeWorkspace } from "@/components/code/CodeWorkspace";
import { useApp } from "@/contexts/app-context";
import { useEditorTheme } from "@/hooks/code/useEditorTheme";
import { GoblinLogo } from "@/components/brand/GoblinLogo";
import { API_URL, getToken } from "@/hooks/code/getToken";

interface CodeTabProps {
  projectId: string;
  projectName?: string;
  pendingCode?: { content: string; filename?: string } | null;
}

type Availability = "probing" | "available" | "unavailable";

/**
 * Code Tab orchestrator (Sprint 7).
 *
 * Probes the multi-session `/code-sessions` API once. If it answers, renders the
 * new multi-session workspace (parallel sessions, in-tab AI composer, streaming
 * agent). If it's unavailable (endpoint not deployed / migration 0055 not applied),
 * falls back to the Sprint-6 single-buffer editor — so the shipped light editor +
 * Save↔Deploy Zwischenraum never regress, even before the backend is live.
 */
export function CodeTab({ projectId, projectName = "project", pendingCode }: CodeTabProps) {
  const { setPendingCodePayload } = useApp();
  const [theme] = useEditorTheme();
  const [avail, setAvail] = useState<Availability>("probing");

  // FOUNDER-WALK-6 · U5 (F1): `pendingCodePayload` is a single global
  // context value with no project scope of its own, set by a "send to code"
  // event dispatched from the chat panel that is always showing THIS
  // project (there is exactly one dispatcher, ChatTab, and it is only ever
  // mounted alongside the project it sends to) — so a payload still sitting
  // unconsumed the moment `projectId` changes can only be stale, never
  // meant for the project being switched to. Clear it right then, before
  // this project's CodeWorkspace ever sees it as `pendingCode`.
  const prevProjectIdRef = useRef(projectId);
  useEffect(() => {
    if (prevProjectIdRef.current !== projectId) {
      prevProjectIdRef.current = projectId;
      setPendingCodePayload(null);
    }
  }, [projectId, setPendingCodePayload]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await getToken();
        if (!t) { if (!cancelled) setAvail("unavailable"); return; }
        const res = await fetch(`${API_URL}/api/code-sessions?projectId=${encodeURIComponent(projectId)}`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (cancelled) return;
        // 200 → available. 400 (bad project) still means the endpoint exists → available.
        // 404 (route missing) / 5xx (table missing) → fall back to classic.
        setAvail(res.status === 404 || res.status >= 500 ? "unavailable" : "available");
      } catch {
        if (!cancelled) setAvail("unavailable");
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  if (avail === "probing") {
    return (
      <div className="gb-codetab" data-editor-theme={theme} style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ed-canvas)" }}>
        <GoblinLogo state="breath" size={26} variant="green" />
      </div>
    );
  }

  if (avail === "available") {
    return (
      <CodeWorkspace
        projectId={projectId}
        pendingCode={pendingCode}
        onPendingConsumed={() => setPendingCodePayload(null)}
      />
    );
  }

  // Graceful fallback — the Sprint-6 Code Tab, untouched.
  return <CodeTabClassic projectId={projectId} projectName={projectName} pendingCode={pendingCode} />;
}
