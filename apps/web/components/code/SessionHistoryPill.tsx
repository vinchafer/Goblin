"use client";

// WAVE-F (Versionierung & Zeit) F3/F4 — the Zeitleiste (version history) surface.
//
// A quiet footer pill (mirrors SessionGitPill) that expands to a portal panel: the
// project's checkpoints newest-first — a label, when, ±n files, and a source icon
// (agent-run / user "Stand sichern" / verified publish). Tapping a checkpoint reveals
// its diff-vs-current (added / geändert / entfernt), and each changed file opens an
// accurate line diff (the SAME unifiedDiffLines engine the DiffSheet uses). Two actions:
// "Wiederherstellen" (honest confirm naming what changes) and "Nur ansehen".
//
// Publish checkpoints carry their VERIFIED deployed URL (F4 "frühere Versionen"), shown
// as an openable link — never an unverified claim.
//
// Honest-hide: the pill renders NOTHING until it has confirmed the feature is available
// (migration 0095 applied). Sage&Copper editor tokens (--ed-*), 375px-first, dark+light,
// safe-area insets — consistent with the rest of the Code Tab.

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { History, X, RotateCcw, Bot, User as UserIcon, Rocket, ExternalLink } from "lucide-react";
import { GoblinLogo } from "@/components/brand/GoblinLogo";
import { API_URL, getToken } from "@/hooks/code/getToken";
import { useLang, t } from "@/lib/use-lang";
import { unifiedDiffLines } from "@/lib/file-compare";

type Source = "agent-run" | "user" | "publish";

interface Checkpoint {
  id: string;
  label: string;
  createdBy: Source;
  runId: string | null;
  deployedUrl: string | null;
  createdAt: string;
  fileCount: number;
  byteTotal: number;
  changedFromPrev: number;
}

interface FileChange {
  path: string;
  status: "added" | "removed" | "modified" | "unchanged";
}

/** Relative "vor X" / "X ago" — coarse, honest (no fabricated seconds precision). */
function relTime(iso: string, lang: "de" | "en"): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (!Number.isFinite(diff)) return "";
  const min = Math.floor(diff / 60000);
  if (min < 1) return t(lang, "gerade eben", "just now");
  if (min < 60) return t(lang, `vor ${min} Min`, `${min} min ago`);
  const hr = Math.floor(min / 60);
  if (hr < 24) return t(lang, `vor ${hr} Std`, `${hr} h ago`);
  const d = Math.floor(hr / 24);
  if (d < 30) return t(lang, `vor ${d} Tag${d === 1 ? "" : "en"}`, `${d} d ago`);
  return new Date(iso).toLocaleDateString(lang === "de" ? "de-DE" : "en-US");
}

function SourceIcon({ s }: { s: Source }) {
  if (s === "publish") return <Rocket size={14} style={{ color: "var(--ed-accent, var(--ed-primary))" }} />;
  if (s === "user") return <UserIcon size={14} style={{ color: "var(--ed-fg-2)" }} />;
  return <Bot size={14} style={{ color: "var(--ed-fg-2)" }} />;
}

export function SessionHistoryPill({ projectId, onRestored }: { projectId: string; onRestored?: () => void }) {
  const lang = useLang();
  const [available, setAvailable] = useState<boolean | null>(null); // null = not yet probed
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [changes, setChanges] = useState<Record<string, FileChange[]>>({});
  const [fileDiff, setFileDiff] = useState<{ cpId: string; path: string; base: string; current: string } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<Checkpoint | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const authed = useCallback(async (path: string, init?: RequestInit) => {
    const tok = await getToken();
    if (!tok) return null;
    return fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${tok}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    });
  }, []);

  const load = useCallback(async () => {
    const res = await authed(`/api/projects/${encodeURIComponent(projectId)}/checkpoints`);
    if (!res || !res.ok) { setAvailable(false); return; }
    const data = await res.json() as { available: boolean; checkpoints: Checkpoint[] };
    setAvailable(data.available);
    setCheckpoints(data.checkpoints ?? []);
    setCount((data.checkpoints ?? []).length);
  }, [authed, projectId]);

  // Probe on mount so an unavailable feature (pre-0095) is honest-hidden entirely.
  useEffect(() => { void load(); }, [load]);

  const openDiff = useCallback(async (cp: Checkpoint) => {
    if (expanded === cp.id) { setExpanded(null); return; }
    setExpanded(cp.id);
    if (!changes[cp.id]) {
      const res = await authed(`/api/projects/${encodeURIComponent(projectId)}/checkpoints/${cp.id}/diff`);
      if (res && res.ok) {
        const data = await res.json() as { changes: FileChange[] };
        setChanges((m) => ({ ...m, [cp.id]: data.changes.filter((c) => c.status !== "unchanged") }));
      }
    }
  }, [authed, projectId, changes, expanded]);

  const openFileDiff = useCallback(async (cp: Checkpoint, path: string) => {
    const res = await authed(`/api/projects/${encodeURIComponent(projectId)}/checkpoints/${cp.id}/file?path=${encodeURIComponent(path)}`);
    if (res && res.ok) {
      const data = await res.json() as { base: string | null; current: string | null };
      setFileDiff({ cpId: cp.id, path, base: data.base ?? "", current: data.current ?? "" });
    }
  }, [authed, projectId]);

  const doRestore = useCallback(async (cp: Checkpoint) => {
    setBusy(true); setNote(null);
    const res = await authed(`/api/projects/${encodeURIComponent(projectId)}/checkpoints/${cp.id}/restore`, { method: "POST", body: "{}" });
    setBusy(false); setConfirmRestore(null);
    if (!res) { setNote(t(lang, "Nicht angemeldet.", "Not signed in.")); return; }
    if (res.ok) {
      const data = await res.json() as { restored: number; removed: number };
      setNote(t(lang, `Wiederhergestellt ✓ (${data.restored} Datei${data.restored === 1 ? "" : "en"})`, `Restored ✓ (${data.restored} file${data.restored === 1 ? "" : "s"})`));
      await load();
      onRestored?.();
      setTimeout(() => setNote(null), 3500);
    } else if (res.status === 409) {
      const data = await res.json().catch(() => ({})) as { error?: string; message?: string };
      setNote(data.message ?? t(lang, "Gerade nicht möglich.", "Not possible right now."));
    } else {
      setNote(t(lang, "Wiederherstellung fehlgeschlagen. Es wurde nichts verändert.", "Restore failed. Nothing was changed."));
    }
  }, [authed, projectId, lang, load, onRestored]);

  // Honest-hide: render nothing until availability is confirmed true.
  if (available !== true) return null;

  return (
    <>
      <button
        onClick={() => { setOpen(true); void load(); }}
        title={t(lang, "Verlauf", "History")} aria-label={t(lang, "Verlauf öffnen", "Open history")}
        data-testid="history-pill"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "transparent", border: "1px solid var(--ed-rule)",
          color: "var(--ed-fg-2)", borderRadius: 8, padding: "5px 10px",
          fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)", flexShrink: 0,
        }}
      >
        <History size={13} />
        <span>{t(lang, "Verlauf", "History")}{count ? ` · ${count}` : ""}</span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 120 }} />
          <div className="gb-hist-panel" role="dialog" aria-label={t(lang, "Verlauf", "History")} data-testid="history-panel">
            <style>{`
              .gb-hist-panel { position: fixed; top: 0; right: 0; height: 100dvh; width: 400px; max-width: 92vw;
                background: var(--ed-chrome-2, var(--ed-chrome)); border-left: 1px solid var(--ed-rule);
                z-index: 121; display: flex; flex-direction: column; box-shadow: -12px 0 40px rgba(15,43,30,0.22);
                animation: gbHistIn 0.16s ease-out; }
              @keyframes gbHistIn { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; } }
              @media (max-width: 680px) {
                .gb-hist-panel { top: auto; bottom: 0; right: 0; left: 0; height: auto; max-height: 82dvh; width: 100%;
                  max-width: 100%; border-left: none; border-top: 1px solid var(--ed-rule);
                  border-radius: 16px 16px 0 0; animation: gbHistInM 0.18s ease-out;
                  padding-bottom: env(safe-area-inset-bottom, 0px); }
                @keyframes gbHistInM { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
              }
            `}</style>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: "1px solid var(--ed-rule)" }}>
              <History size={16} style={{ color: "var(--ed-fg-1)" }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)" }}>{t(lang, "Verlauf", "History")}</span>
              <button onClick={() => setOpen(false)} aria-label={t(lang, "Schließen", "Close")} style={{ background: "transparent", border: "none", color: "var(--ed-fg-3)", cursor: "pointer", display: "inline-flex" }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {checkpoints === null ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><GoblinLogo state="breath" size={22} variant="green" /></div>
              ) : checkpoints.length === 0 ? (
                <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ed-fg-2)", fontFamily: "var(--font-sans)", margin: "12px 4px" }}>
                  {t(lang, "Noch keine gespeicherten Stände. Vor jedem Agent-Lauf und beim Sichern wird automatisch ein Stand angelegt.", "No saved states yet. A checkpoint is created automatically before each agent run and when you save.")}
                </p>
              ) : (
                checkpoints.map((cp) => (
                  <div key={cp.id} data-testid="history-item" style={{ border: "1px solid var(--ed-rule)", borderRadius: 10, background: "var(--ed-canvas)", overflow: "hidden" }}>
                    <button
                      onClick={() => void openDiff(cp)}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "10px 12px", cursor: "pointer", fontFamily: "var(--font-sans)" }}
                    >
                      <SourceIcon s={cp.createdBy} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ed-fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cp.label}</span>
                        <span style={{ display: "block", fontSize: 11.5, color: "var(--ed-fg-3)", marginTop: 2 }}>
                          {relTime(cp.createdAt, lang)} · {cp.fileCount} {t(lang, "Dateien", "files")}
                          {cp.changedFromPrev > 0 ? ` · ±${cp.changedFromPrev}` : ""}
                        </span>
                      </span>
                    </button>

                    {expanded === cp.id && (
                      <div style={{ borderTop: "1px solid var(--ed-rule)", padding: "8px 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                        {cp.deployedUrl && (
                          <a href={cp.deployedUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: "var(--ed-accent, var(--ed-primary))", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-sans)" }}>
                            <ExternalLink size={13} /> {t(lang, "Veröffentlichte Version öffnen", "Open published version")}
                          </a>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {(changes[cp.id] ?? []).length === 0 ? (
                            <span style={{ fontSize: 12, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)" }}>
                              {changes[cp.id] ? t(lang, "Identisch mit dem aktuellen Stand.", "Identical to the current state.") : t(lang, "Vergleiche…", "Comparing…")}
                            </span>
                          ) : (changes[cp.id] ?? []).map((f) => (
                            <button key={f.path} onClick={() => void openFileDiff(cp, f.path)} data-testid="history-file"
                              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "5px 6px", borderRadius: 6, cursor: "pointer", fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
                              <StatusBadge status={f.status} lang={lang} />
                              <span style={{ color: "var(--ed-fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.path}</span>
                            </button>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                          <button onClick={() => setConfirmRestore(cp)} data-testid="history-restore"
                            style={{ ...primaryBtn, flex: 1 }}>
                            <RotateCcw size={14} /> {t(lang, "Wiederherstellen", "Restore")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              {note && <div style={{ fontSize: 12.5, color: "var(--ed-fg-2)", fontFamily: "var(--font-sans)", padding: "8px 10px", background: "var(--ed-canvas)", borderRadius: 8, border: "1px solid var(--ed-rule)" }}>{note}</div>}
            </div>
          </div>

          {/* Inline line diff for a single file (base = checkpoint, proposed = current). */}
          {fileDiff && (
            <div data-testid="history-file-diff" style={{ position: "fixed", inset: 0, zIndex: 130, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div onClick={() => setFileDiff(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
              <div style={{ position: "relative", background: "var(--ed-canvas)", borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "82dvh", display: "flex", flexDirection: "column", borderTop: "1px solid var(--ed-rule)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid var(--ed-rule)" }}>
                  <span style={{ flex: 1, fontSize: 12.5, fontFamily: "var(--font-mono, monospace)", color: "var(--ed-fg-1)", overflow: "hidden", textOverflow: "ellipsis" }}>{fileDiff.path}</span>
                  <span style={{ fontSize: 11, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)" }}>{t(lang, "Stand → aktuell", "checkpoint → current")}</span>
                  <button onClick={() => setFileDiff(null)} aria-label={t(lang, "Schließen", "Close")} style={{ background: "transparent", border: "none", color: "var(--ed-fg-3)", cursor: "pointer", display: "inline-flex" }}><X size={16} /></button>
                </div>
                <div style={{ overflow: "auto", padding: "8px 0", fontFamily: "var(--font-mono, monospace)", fontSize: 12, lineHeight: 1.5 }}>
                  {unifiedDiffLines(fileDiff.path, fileDiff.base, fileDiff.current).map((ln, i) => (
                    <div key={i} style={{
                      padding: "0 12px", whiteSpace: "pre-wrap", wordBreak: "break-word",
                      color: ln.kind === "add" ? "var(--ed-draft, #3D7A4F)" : ln.kind === "del" ? "var(--ed-danger, #B0432A)" : ln.kind === "hunk" ? "var(--ed-fg-3)" : "var(--ed-fg-2)",
                      background: ln.kind === "add" ? "rgba(61,122,79,0.10)" : ln.kind === "del" ? "rgba(176,67,42,0.10)" : "transparent",
                    }}>
                      {ln.kind === "add" ? "+" : ln.kind === "del" ? "−" : ln.kind === "hunk" ? "" : " "}{ln.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Restore confirm — honestly names what will change. */}
          {confirmRestore && (
            <div data-testid="history-confirm" style={{ position: "fixed", inset: 0, zIndex: 140, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
              <div onClick={() => setConfirmRestore(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
              <div style={{ position: "relative", background: "var(--ed-chrome-2, var(--ed-canvas))", border: "1px solid var(--ed-rule)", borderRadius: 14, padding: 18, maxWidth: 360, width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)" }}>{t(lang, "Diesen Stand wiederherstellen?", "Restore this checkpoint?")}</span>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ed-fg-2)", fontFamily: "var(--font-sans)", margin: 0 }}>
                  {t(lang,
                    `Die Projektdateien werden auf „${confirmRestore.label}" zurückgesetzt. Dein aktueller Stand wird vorher automatisch gesichert — du kannst das also wieder rückgängig machen.`,
                    `Your project files will be reset to "${confirmRestore.label}". Your current state is saved first, so you can undo this too.`)}
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setConfirmRestore(null)} style={secondaryBtn}>{t(lang, "Abbrechen", "Cancel")}</button>
                  <button onClick={() => void doRestore(confirmRestore)} disabled={busy} data-testid="history-confirm-accept" style={{ ...primaryBtn, opacity: busy ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }}>
                    {busy ? <GoblinLogo state="working" size={14} variant="gold" /> : <RotateCcw size={14} />} {t(lang, "Wiederherstellen", "Restore")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>,
        document.body,
      )}
    </>
  );
}

function StatusBadge({ status, lang }: { status: FileChange["status"]; lang: "de" | "en" }) {
  const map = {
    added: { txt: t(lang, "NEU", "NEW"), bg: "rgba(61,122,79,0.14)", fg: "var(--ed-draft, #3D7A4F)" },
    modified: { txt: t(lang, "GEÄNDERT", "CHANGED"), bg: "rgba(199,144,26,0.16)", fg: "var(--ed-warning, #C7901A)" },
    removed: { txt: t(lang, "ENTFERNT", "REMOVED"), bg: "rgba(176,67,42,0.14)", fg: "var(--ed-danger, #B0432A)" },
    unchanged: { txt: "=", bg: "transparent", fg: "var(--ed-fg-3)" },
  }[status];
  return <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em", padding: "2px 5px", borderRadius: 5, background: map.bg, color: map.fg, fontFamily: "var(--font-sans)", flexShrink: 0, minWidth: 54, textAlign: "center" }}>{map.txt}</span>;
}

const primaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
  background: "var(--ed-primary)", color: "var(--ed-on-primary)", border: "none",
  borderRadius: 9, padding: "9px 13px", fontSize: 13, fontWeight: 600,
  fontFamily: "var(--font-sans)", cursor: "pointer",
};
const secondaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: "transparent", color: "var(--ed-fg-2)", border: "1px solid var(--ed-rule)",
  borderRadius: 9, padding: "9px 13px", fontSize: 13, fontWeight: 600,
  fontFamily: "var(--font-sans)", cursor: "pointer",
};
