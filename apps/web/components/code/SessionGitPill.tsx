"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GitBranch, Github, X } from "lucide-react";
import { GoblinLogo } from "@/components/brand/GoblinLogo";
import { API_URL, getToken } from "@/hooks/code/getToken";

interface GitStatus {
  connected: boolean;
  username: string | null;
  repo: { url: string; slug: string } | null;
}

/**
 * Git surface (Sprint 10, Slice 4) — a small status pill in the workspace footer
 * that expands to a panel. READ: account connection + linked repo. WRITE: commit
 * message + Push (snapshots all project files as a new commit on the linked repo;
 * first push creates the repo). Honest about the model: the store is a Backblaze
 * snapshot, not a git working tree, so there's no per-file staging to fake.
 *
 * Invisible weight for Max (a quiet footer pill); instant reach for Sofia.
 */
export function SessionGitPill({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [repoName, setRepoName] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const t = await getToken();
    if (!t) { setStatus({ connected: false, username: null, repo: null }); return; }
    try {
      const res = await fetch(`${API_URL}/api/github/project-status?projectId=${encodeURIComponent(projectId)}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) setStatus(await res.json());
      else setStatus({ connected: false, username: null, repo: null });
    } catch {
      setStatus({ connected: false, username: null, repo: null });
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    const t = await getToken();
    if (!t) return;
    const returnTo = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/dashboard";
    try {
      const res = await fetch(`${API_URL}/api/github/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ returnTo }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { setNote("Verbindung fehlgeschlagen"); }
  };

  const push = async () => {
    const t = await getToken();
    if (!t) return;
    setBusy(true); setNote(null);
    try {
      const body: Record<string, unknown> = { projectId, message: message.trim() || undefined };
      if (!status?.repo) body.name = (repoName.trim() || undefined);
      const res = await fetch(`${API_URL}/api/github/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNote("Gepusht ✓");
        setMessage("");
        await load();
        setTimeout(() => setNote(null), 2500);
      } else {
        setNote(data.error || "Push fehlgeschlagen");
      }
    } catch { setNote("Push fehlgeschlagen"); }
    setBusy(false);
  };

  // Pill dot colour: green = linked repo, gold = connected/unlinked, grey = no account.
  const dot = status?.repo ? "#6db97b" : status?.connected ? "var(--ed-accent)" : "var(--ed-fg-3)";
  const label = status?.repo ? status.repo.slug.split("/").pop() : status?.connected ? "GitHub" : "GitHub";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Git / GitHub"
        aria-label="Git-Panel öffnen"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "transparent", border: "1px solid var(--ed-rule)",
          color: "var(--ed-fg-2)", borderRadius: 8, padding: "5px 10px",
          fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)", flexShrink: 0,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
        <GitBranch size={13} />
        <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      </button>

      {/* F-14: render the scrim + panel through a PORTAL to <body>. The code surface has
          position:relative / transformed ancestors (split-screen panes), which turn a
          `position: fixed` child into one positioned relative to that ancestor — so the
          panel's top:0 landed at the top of the (off-screen) pane, not the viewport. In
          the body it is truly viewport-fixed and always reachable. */}
      {open && typeof document !== "undefined" && createPortal(
        <>
          <div onClick={() => setOpen(false)} className="gb-git-scrim" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 120 }} />
          <div className="gb-git-panel" role="dialog" aria-label="Git">
            <style>{`
              .gb-git-panel { position: fixed; top: 0; right: 0; height: 100dvh; width: 380px; max-width: 92vw;
                background: var(--ed-chrome-2, var(--ed-chrome)); border-left: 1px solid var(--ed-rule);
                z-index: 121; display: flex; flex-direction: column; box-shadow: -12px 0 40px rgba(15,43,30,0.22);
                animation: gbGitIn 0.16s ease-out; }
              @keyframes gbGitIn { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; } }
              @media (max-width: 680px) {
                .gb-git-panel { top: auto; bottom: 0; right: 0; left: 0; height: auto; max-height: 80dvh; width: 100%;
                  max-width: 100%; border-left: none; border-top: 1px solid var(--ed-rule);
                  border-radius: 16px 16px 0 0; animation: gbGitInM 0.18s ease-out;
                  /* SAFEAREA-U-BOTTOM: docked to the screen bottom on mobile — pad
                     the panel by the iOS home-indicator inset (0 in a browser). */
                  padding-bottom: env(safe-area-inset-bottom, 0px); }
                @keyframes gbGitInM { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
              }
            `}</style>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: "1px solid var(--ed-rule)" }}>
              <Github size={16} style={{ color: "var(--ed-fg-1)" }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)" }}>GitHub</span>
              <button onClick={() => setOpen(false)} aria-label="Schließen" style={{ background: "transparent", border: "none", color: "var(--ed-fg-3)", cursor: "pointer", display: "inline-flex" }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              {status === null ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><GoblinLogo state="breath" size={22} variant="green" /></div>
              ) : !status.connected ? (
                <>
                  <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ed-fg-2)", fontFamily: "var(--font-sans)", margin: 0 }}>
                    Hier landen technische Details über deinen Code. Verbinde GitHub, um dein Projekt als echtes Repository zu sichern.
                  </p>
                  <button onClick={connect} style={primaryBtn}>
                    <Github size={15} /> Mit GitHub verbinden
                  </button>
                </>
              ) : (
                <>
                  {/* Status */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <Row k="Konto" v={status.username ? `@${status.username}` : "verbunden"} />
                    <Row k="Repository" v={status.repo ? status.repo.slug : "noch nicht verknüpft"} />
                  </div>

                  {!status.repo && (
                    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <span style={fieldLabel}>Repo-Name (erster Push erstellt es)</span>
                      <input value={repoName} onChange={(e) => setRepoName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, "-"))} placeholder="mein-projekt" style={inputStyle} />
                    </label>
                  )}

                  <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <span style={fieldLabel}>Commit-Nachricht</span>
                    <input value={message} onChange={(e) => setMessage(e.target.value.slice(0, 200))} placeholder="Was hast du geändert?" style={inputStyle} />
                  </label>

                  <button onClick={push} disabled={busy || (!status.repo && !repoName.trim())} style={{ ...primaryBtn, opacity: busy || (!status.repo && !repoName.trim()) ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }}>
                    {busy ? <GoblinLogo state="working" size={14} variant="gold" /> : <GitBranch size={15} />}
                    {status.repo ? "Commit + Push" : "Repo erstellen + Push"}
                  </button>

                  <p style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)", margin: 0 }}>
                    Push schickt alle Projektdateien als neuen Commit zu GitHub.
                  </p>

                  {status.repo && (
                    <a href={status.repo.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: "var(--ed-accent)", textDecoration: "none", fontFamily: "var(--font-sans)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Github size={13} /> Auf GitHub ansehen →
                    </a>
                  )}
                </>
              )}

              {note && <div style={{ fontSize: 12.5, color: "var(--ed-fg-2)", fontFamily: "var(--font-sans)", padding: "8px 10px", background: "var(--ed-canvas)", borderRadius: 8, border: "1px solid var(--ed-rule)" }}>{note}</div>}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

const primaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  background: "var(--ed-primary)", color: "var(--ed-on-primary)", border: "none",
  borderRadius: 9, padding: "10px 14px", fontSize: 13.5, fontWeight: 600,
  fontFamily: "var(--font-sans)", cursor: "pointer",
};
const fieldLabel: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.05em" };
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid var(--ed-rule)",
  background: "var(--ed-canvas)", color: "var(--ed-fg-1)", fontSize: 13, fontFamily: "var(--font-sans)",
  outline: "none", boxSizing: "border-box",
};

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, fontFamily: "var(--font-sans)" }}>
      <span style={{ color: "var(--ed-fg-3)" }}>{k}</span>
      <span style={{ color: "var(--ed-fg-1)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{v}</span>
    </div>
  );
}
