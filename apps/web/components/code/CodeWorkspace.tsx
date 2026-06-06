"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Icon } from "@/components/ui/icon";
import { GoblinLogo } from "@/components/brand/GoblinLogo";
import { SessionTabs } from "./SessionTabs";
import { SessionPane } from "./SessionPane";
import { SessionPickerDialog } from "./SessionPickerDialog";
import { useCodeSessions } from "@/hooks/code/useCodeSessions";
import { useEditorTheme } from "@/hooks/code/useEditorTheme";
import { API_URL, getToken } from "@/hooks/code/getToken";
import { getStoredIntent, DEFAULT_INTENT, type Intent } from "@/lib/intent";
import { titleFromPath } from "@/lib/session-title";

interface Props {
  projectId: string;
  pendingCode?: { content: string; filename?: string; files?: { path: string; content: string }[] } | null;
  onPendingConsumed?: () => void;
}

/**
 * The multi-session Code Tab shell: session tabs + theme toggle on top, the active
 * session's pane below. Routes Send-to-Code payloads into a session (0 → create,
 * 1 → inject, 2+ → picker). Only rendered when the sessions API is available; the
 * orchestrator falls back to the classic single-buffer editor otherwise.
 */
export function CodeWorkspace({ projectId, pendingCode, onPendingConsumed }: Props) {
  const s = useCodeSessions(projectId);
  const [theme, , toggleTheme] = useEditorTheme();
  const [picker, setPicker] = useState<{ content: string; filename?: string } | null>(null);
  const autoCreated = useRef(false);
  const consumedRef = useRef(false);

  // Intent → first-paint foreground. Seed synchronously from the localStorage hint
  // (correct even pre-migration), then let the persisted DB value override.
  const [intent, setIntent] = useState<Intent>(() => getStoredIntent(projectId) ?? DEFAULT_INTENT);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await getToken();
      if (!t) return;
      try {
        const res = await fetch(`${API_URL}/api/projects/${projectId}`, { headers: { Authorization: `Bearer ${t}` } });
        if (!res.ok || cancelled) return;
        const p = await res.json();
        if (!cancelled && p?.intent) setIntent(p.intent as Intent);
      } catch { /* keep the localStorage/default hint */ }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  // B-S4: code sent from a project-less chat is stashed in sessionStorage, then
  // we land here. Re-dispatch it so the normal Send-to-Code path (create/inject/
  // picker) handles it. Runs once on mount; key is cleared immediately.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("goblin:stc-pending");
      if (!raw) return;
      sessionStorage.removeItem("goblin:stc-pending");
      const payload = JSON.parse(raw) as { content?: string; filename?: string; files?: { path: string; content: string }[] };
      // 10.8-5: a previewed multi-file send carries files[]; replay it so the
      // multi-file seeding path (CodeWorkspace) creates one session with all of them.
      if (payload?.files && payload.files.length > 0) {
        const first = payload.files[0]!;
        window.dispatchEvent(new CustomEvent("goblin:sendToCode", {
          detail: { code: first.content, filename: first.path, files: payload.files },
        }));
      } else if (payload?.content) {
        window.dispatchEvent(new CustomEvent("goblin:sendToCode", {
          detail: { code: payload.content, filename: payload.filename },
        }));
      }
    } catch { /* ignore */ }
  }, []);

  // Auto-create a first session so the tab is ready to talk to (once).
  useEffect(() => {
    if (s.available && !s.loading && s.sessions.length === 0 && !autoCreated.current && !pendingCode) {
      autoCreated.current = true;
      s.createSession({ name: "Neue Session" });
    }
  }, [s.available, s.loading, s.sessions.length, s, pendingCode]);

  const injectIntoSession = useCallback(async (sessionId: string, content: string, filename?: string) => {
    const t = await getToken();
    if (!t) return;
    await fetch(`${API_URL}/api/code-sessions/${sessionId}/files`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ path: filename || "index.html", content, changeState: "draft" }),
    });
    s.setActiveSessionId(sessionId);
    s.refresh();
  }, [s]);

  // Route an incoming Send-to-Code payload.
  useEffect(() => {
    if (!pendingCode || consumedRef.current || s.loading || !s.available) return;
    consumedRef.current = true;
    (async () => {
      // 10.6-2: a multi-block send carries real separate files. Seed a fresh session
      // with all of them as drafts (index.html + style.css + script.js → valid deploy).
      const files = pendingCode.files;
      const [firstFile, ...restFiles] = files ?? [];
      if (files && files.length > 1 && firstFile) {
        const ns = await s.createSession({ initialContent: firstFile.content, initialFilename: firstFile.path, name: titleFromPath(firstFile.path) ?? "Aus dem Chat" });
        const sid = ns?.id;
        if (sid) {
          const t = await getToken();
          for (const f of restFiles) {
            if (!t) break;
            await fetch(`${API_URL}/api/code-sessions/${sid}/files`, {
              method: "PATCH",
              headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
              body: JSON.stringify({ path: f.path, content: f.content, changeState: "draft" }),
            });
          }
          s.setActiveSessionId(sid);
          s.refresh();
        }
        onPendingConsumed?.();
        return;
      }

      const only = s.sessions[0];
      if (s.sessions.length === 0) {
        await s.createSession({ initialContent: pendingCode.content, initialFilename: pendingCode.filename, name: titleFromPath(pendingCode.filename) ?? "Aus dem Chat" });
      } else if (s.sessions.length === 1 && only) {
        await injectIntoSession(only.id, pendingCode.content, pendingCode.filename);
      } else {
        setPicker({ content: pendingCode.content, filename: pendingCode.filename });
      }
      onPendingConsumed?.();
    })();
  }, [pendingCode, s, injectIntoSession, onPendingConsumed]);

  const active = s.sessions.find(x => x.id === s.activeSessionId) ?? s.sessions[0] ?? null;

  if (s.loading) {
    return (
      <div className="gb-codetab" data-editor-theme={theme} style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ed-canvas)" }}>
        <GoblinLogo state="breath" size={28} variant="green" />
      </div>
    );
  }

  return (
    <div className="gb-codetab" data-editor-theme={theme} style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--ed-canvas)" }}>
      <SessionTabs
        sessions={s.sessions}
        activeId={active?.id ?? null}
        onSwitch={s.switchSession}
        onCreate={() => s.createSession({ name: `Session ${s.sessions.length + 1}` })}
        onDelete={s.deleteSession}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {active ? (
        <SessionPane
          key={active.id}
          session={active}
          theme={theme}
          intent={intent}
          projectId={projectId}
          onModelChange={(modelId) => s.setSessionModel(active.id, modelId)}
          onDraftCountChange={(n) => s.setDraftCount(active.id, n)}
          onAutoTitle={(name) => s.renameSession(active.id, name)}
        />
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ textAlign: "center", maxWidth: 340 }}>
            <div style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ed-fg-2)", fontFamily: "var(--font-sans)", marginBottom: 16 }}>
              Noch keine Session. Starte eine — dann stell Goblin eine Aufgabe und der Code erscheint hier als Entwurf.
            </div>
            <button
              onClick={() => s.createSession({ name: "Neue Session" })}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--ed-primary)", color: "var(--ed-on-primary)", border: "none", borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}
            >
              <Icon name="add" size={15} /> Neue Session starten
            </button>
          </div>
        </div>
      )}

      {picker && (
        <SessionPickerDialog
          sessions={s.sessions}
          onPick={async (sessionId) => { await injectIntoSession(sessionId, picker.content, picker.filename); setPicker(null); }}
          onNewSession={async () => {
            const ns = await s.createSession({ initialContent: picker.content, initialFilename: picker.filename, name: titleFromPath(picker.filename) ?? "Aus dem Chat" });
            if (ns) s.setActiveSessionId(ns.id);
            setPicker(null);
          }}
          onCancel={() => setPicker(null)}
        />
      )}
    </div>
  );
}
