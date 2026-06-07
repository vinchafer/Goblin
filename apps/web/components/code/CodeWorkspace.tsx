"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { GoblinLogo } from "@/components/brand/GoblinLogo";
import { SessionTabs } from "./SessionTabs";
import { SessionPane } from "./SessionPane";
import { SessionPickerDialog } from "./SessionPickerDialog";
import { useCodeSessions } from "@/hooks/code/useCodeSessions";
import { useEditorTheme } from "@/hooks/code/useEditorTheme";
import { API_URL, getToken } from "@/hooks/code/getToken";
import { getStoredIntent, DEFAULT_INTENT, type Intent } from "@/lib/intent";
import { titleFromPath, titleFromPrompt } from "@/lib/session-title";

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
  const router = useRouter();
  const [theme, , toggleTheme] = useEditorTheme();
  const [picker, setPicker] = useState<{ content: string; filename?: string } | null>(null);
  const autoCreated = useRef(false);
  const consumedRef = useRef(false);
  // C.1 (NAVFIX-6): deterministic Send-to-Code ingest. A project-less chat stashes
  // the payload in sessionStorage and navigates here; previously we re-dispatched a
  // window event (chat → app-context → prop) and raced the auto-create + prop
  // effects, sometimes landing on an empty session. Now the stash is read ONCE,
  // synchronously, into local state — and auto-create is blocked until the stash
  // has been checked (stashChecked) AND while a payload is pending — so the payload
  // is never lost and never lands on an empty session.
  const [stashPayload, setStashPayload] = useState<{ content?: string; filename?: string; files?: { path: string; content: string }[]; prompt?: string } | null>(null);
  const stashChecked = useRef(false);

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

  // C.1: read the Send-to-Code stash ONCE, synchronously into state (no window-event
  // round trip). Runs before the session list resolves, so the routing effect below
  // always has the payload and auto-create can't win the race. The key is cleared
  // immediately so a back/forward navigation doesn't replay it.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("goblin:stc-pending");
      if (raw) {
        sessionStorage.removeItem("goblin:stc-pending");
        const p = JSON.parse(raw) as { content?: string; filename?: string; files?: { path: string; content: string }[]; prompt?: string };
        if (p?.files && p.files.length > 0) setStashPayload({ content: p.files[0]!.content, filename: p.files[0]!.path, files: p.files, prompt: p.prompt });
        else if (p?.content) setStashPayload({ content: p.content, filename: p.filename, prompt: p.prompt });
      }
    } catch { /* ignore */ } finally { stashChecked.current = true; }
  }, []);

  // The one payload to ingest: the app-context prop (legacy same-page send) OR the
  // synchronously-read stash. Either is routed exactly once via consumedRef.
  const incoming = pendingCode ?? stashPayload;

  // Auto-create a first session so the tab is ready to talk to (once). Blocked
  // until the stash has been checked and while any payload is pending — so a fresh
  // Send-to-Code task never lands on an auto-created empty session.
  useEffect(() => {
    if (s.available && !s.loading && s.sessions.length === 0 && !autoCreated.current && !incoming && stashChecked.current) {
      autoCreated.current = true;
      s.createSession({ name: "Neue Session" });
    }
  }, [s.available, s.loading, s.sessions.length, s, incoming]);

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

  const consumeIncoming = useCallback(() => {
    setStashPayload(null);
    onPendingConsumed?.();
  }, [onPendingConsumed]);

  // Route an incoming Send-to-Code payload (C.1/C.2). The payload always maps to a
  // CLEAR, content-titled session of its OWN — never a silent inject into a stale
  // one. 0/1 existing session → create a fresh titled session; 2+ → the picker
  // (which still offers pick-existing or new). The session's draft is foregrounded
  // by useCodeSessionDetail (C.3) so the new task surfaces and doesn't sink behind
  // the project's hydrated files.
  useEffect(() => {
    if (!incoming || consumedRef.current || s.loading || !s.available) return;
    consumedRef.current = true;
    (async () => {
      // 10.6-2: a multi-block send carries real separate files. Seed a fresh session
      // with all of them as drafts (index.html + style.css + script.js → valid deploy).
      // BUG-6: title the new session like the TASK (the originating chat prompt),
      // falling back to the file name only when no prompt is available.
      const stcTitle = titleFromPrompt(stashPayload?.prompt) ?? null;
      const files = incoming.files;
      const [firstFile, ...restFiles] = files ?? [];
      if (files && files.length > 1 && firstFile) {
        const ns = await s.createSession({ initialContent: firstFile.content, initialFilename: firstFile.path, name: stcTitle ?? titleFromPath(firstFile.path) ?? "Aus dem Chat" });
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
        consumeIncoming();
        return;
      }

      if (s.sessions.length >= 2) {
        setPicker({ content: incoming.content ?? "", filename: incoming.filename });
      } else {
        // 0 or 1 existing session: the new task gets its own clear titled session.
        await s.createSession({ initialContent: incoming.content, initialFilename: incoming.filename, name: stcTitle ?? titleFromPath(incoming.filename) ?? "Aus dem Chat" });
      }
      consumeIncoming();
    })();
  }, [incoming, s, consumeIncoming]);

  const active = s.sessions.find(x => x.id === s.activeSessionId) ?? s.sessions[0] ?? null;
  const activeId = active?.id ?? null;

  // Stable callback identities for SessionPane. These were inline arrows before,
  // so they changed identity every render and re-fired SessionPane's draft-count
  // effect each pass — which (with the old unconditional setDraftCount) span an
  // infinite loop. Memoised on the stable hook fns + activeId.
  const handleModelChange = useCallback((modelId: string) => { if (activeId) s.setSessionModel(activeId, modelId); }, [s.setSessionModel, activeId]);
  const handleDraftCount = useCallback((n: number) => { if (activeId) s.setDraftCount(activeId, n); }, [s.setDraftCount, activeId]);
  const handleAutoTitle = useCallback((name: string) => { if (activeId) s.renameSession(activeId, name); }, [s.renameSession, activeId]);

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
        onBackToProject={() => router.push(`/dashboard/project/${projectId}`)}
      />

      {active ? (
        <SessionPane
          key={active.id}
          session={active}
          theme={theme}
          intent={intent}
          projectId={projectId}
          onModelChange={handleModelChange}
          onDraftCountChange={handleDraftCount}
          onAutoTitle={handleAutoTitle}
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
