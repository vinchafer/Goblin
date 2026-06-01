"use client";

import { useEffect, useState } from "react";
import { CodeTabClassic } from "./code-tab-classic";
import { CodeWorkspace } from "@/components/code/CodeWorkspace";
import { useApp } from "@/contexts/app-context";
import { useEditorTheme } from "@/hooks/code/useEditorTheme";
import { GoblinMark } from "@/components/ui/goblin-mark";
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
        <GoblinMark size={26} />
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
