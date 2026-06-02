"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  FileCode, FileJson, FileText, Image as ImageIcon, Palette, File as FileIcon,
  Folder, ChevronRight, Upload, Download, Trash2, ArrowLeft, X,
  Pencil, FolderPlus, FilePlus,
} from "lucide-react";
import { API_URL, getToken } from "@/hooks/code/getToken";

const CodeEditor = dynamic(
  () => import("@/components/editor/code-editor").then((m) => ({ default: m.CodeEditor })),
  { ssr: false, loading: () => <div style={{ padding: 24, color: "var(--ink-3)", fontFamily: "JetBrains Mono, monospace", fontSize: 13 }}>Vorschau lädt…</div> },
);

interface FileMeta { path: string; size: number; modified: string | null; }
interface Props { projectId: string; projectName: string; }

const TEXT_EXT = new Set(["tsx","ts","js","jsx","mjs","cjs","css","scss","sass","less","html","htm","json","md","markdown","txt","csv","xml","svg","vue","svelte","py","rb","go","rs","java","c","h","cpp","yml","yaml","toml","env","sh","sql"]);
const IMAGE_EXT = new Set(["png","jpg","jpeg","gif","webp","ico","bmp","avif"]);

function ext(path: string) { return path.split(".").pop()?.toLowerCase() ?? ""; }

function iconFor(name: string) {
  const e = ext(name);
  if (["tsx","ts","js","jsx","mjs","cjs","vue","svelte","py","rb","go","rs","java","c","h","cpp"].includes(e)) return FileCode;
  if (["css","scss","sass","less"].includes(e)) return Palette;
  if (e === "json") return FileJson;
  if (IMAGE_EXT.has(e)) return ImageIcon;
  if (["html","htm","md","markdown","txt","xml","yml","yaml"].includes(e)) return FileText;
  return FileIcon;
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kb`;
  return `${(n / 1024 / 1024).toFixed(1)} mb`;
}
function ago(iso: string | null) {
  if (!iso) return "";
  const d = Date.now() - new Date(iso).getTime();
  const h = Math.floor(d / 3600000), dd = Math.floor(d / 86400000), m = Math.floor(d / 60000);
  if (m < 2) return "gerade eben";
  if (h < 1) return `vor ${m} min`;
  if (h < 24) return `vor ${h} std`;
  if (dd < 30) return `vor ${dd} ${dd === 1 ? "tag" : "tagen"}`;
  return `vor ${Math.floor(dd / 30)} mon`;
}

export function FileExplorer({ projectId, projectName }: Props) {
  const [entries, setEntries] = useState<FileMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [cwd, setCwd] = useState("");                       // current folder, "" = root
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ kind: "text" | "image" | "binary"; text?: string; dataUrl?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [confirmFolderDel, setConfirmFolderDel] = useState<string | null>(null);
  // Name prompt for rename / new file / new folder (Slice 6).
  const [namePrompt, setNamePrompt] = useState<{ kind: "rename" | "newfile" | "newfolder"; from?: string; value: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const authFetch = useCallback(async (path: string, init?: RequestInit) => {
    const t = await getToken();
    return fetch(`${API_URL}${path}`, { ...init, headers: { Authorization: `Bearer ${t}`, ...(init?.headers ?? {}) } });
  }, []);

  // Load the file tree on mount + whenever a mutation bumps reloadKey. Inline
  // (not a useCallback dep) so the effect identity is rock-stable.
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const t = await getToken();
        const r = await fetch(`${API_URL}/api/projects/${projectId}/files-tree`, { headers: { Authorization: `Bearer ${t}` } });
        const d = await r.json();
        if (alive) setEntries((d.entries ?? []).filter((e: FileMeta) => !e.path.startsWith(".trash/")));
      } catch { /* */ } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [projectId, reloadKey]);

  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  // Folders + files directly inside cwd.
  const { folders, files } = useMemo(() => {
    const prefix = cwd ? cwd + "/" : "";
    const folderSet = new Set<string>();
    const fileList: FileMeta[] = [];
    for (const e of entries) {
      if (!e.path.startsWith(prefix)) continue;
      const rest = e.path.slice(prefix.length);
      if (!rest) continue;
      const slash = rest.indexOf("/");
      if (slash === -1) fileList.push({ ...e, path: e.path });
      else folderSet.add(rest.slice(0, slash));
    }
    return {
      folders: [...folderSet].sort(),
      files: fileList.sort((a, b) => a.path.localeCompare(b.path)),
    };
  }, [entries, cwd]);

  const openFile = useCallback(async (path: string) => {
    setSelected(path);
    setPreview(null);
    const e = ext(path);
    try {
      if (IMAGE_EXT.has(e)) {
        const r = await authFetch(`/api/projects/${projectId}/files-raw/${path.split("/").map(encodeURIComponent).join("/")}`);
        const d = await r.json();
        setPreview({ kind: "image", dataUrl: `data:${d.contentType};base64,${d.base64}` });
      } else if (TEXT_EXT.has(e)) {
        const r = await authFetch(`/api/projects/${projectId}/files/${path.split("/").map(encodeURIComponent).join("/")}`);
        const d = await r.json();
        setPreview({ kind: "text", text: d.content ?? "" });
      } else {
        setPreview({ kind: "binary" });
      }
    } catch { setPreview({ kind: "binary" }); }
  }, [authFetch, projectId]);

  const download = useCallback(async (path: string) => {
    try {
      const r = await authFetch(`/api/projects/${projectId}/files-raw/${path.split("/").map(encodeURIComponent).join("/")}`);
      const d = await r.json();
      const bin = atob(d.base64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: d.contentType }));
      const a = document.createElement("a");
      a.href = url; a.download = path.split("/").pop() ?? "datei"; a.click();
      URL.revokeObjectURL(url);
    } catch { flash("Download fehlgeschlagen"); }
  }, [authFetch, projectId]);

  const doDelete = useCallback(async (path: string) => {
    setConfirmDel(null); setBusy(true);
    try {
      await authFetch(`/api/projects/${projectId}/files/${path.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE" });
      if (selected === path) { setSelected(null); setPreview(null); }
      await load(); flash("Gelöscht");
    } catch { flash("Löschen fehlgeschlagen"); } finally { setBusy(false); }
  }, [authFetch, projectId, selected, load]);

  const onUpload = useCallback(async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { flash("Datei zu gross (max 10MB)"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("path", cwd);
      const r = await authFetch(`/api/projects/${projectId}/files/upload`, { method: "POST", body: fd });
      if (!r.ok) throw new Error();
      await load(); flash(`${file.name} hochgeladen`);
    } catch { flash("Upload fehlgeschlagen"); } finally { setBusy(false); }
  }, [authFetch, projectId, cwd, load]);

  // ── Slice 6 ops: rename/move, new file, new folder, folder delete ──
  const submitPrompt = useCallback(async () => {
    if (!namePrompt) return;
    const raw = namePrompt.value.trim();
    if (!raw) return;
    setBusy(true);
    try {
      if (namePrompt.kind === "rename" && namePrompt.from) {
        // Allow a bare name (rename in place) or a relative path (move).
        const to = raw.includes("/") ? raw.replace(/^\/+/, "") : (cwd ? `${cwd}/${raw}` : raw);
        const r = await authFetch(`/api/projects/${projectId}/files/rename`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: namePrompt.from, to }),
        });
        if (!r.ok) throw new Error();
        if (selected === namePrompt.from) { setSelected(null); setPreview(null); }
        flash("Umbenannt");
      } else if (namePrompt.kind === "newfile") {
        const path = cwd ? `${cwd}/${raw}` : raw;
        const r = await authFetch(`/api/projects/${projectId}/files`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, content: "" }),
        });
        if (!r.ok) throw new Error();
        flash("Datei erstellt");
      } else if (namePrompt.kind === "newfolder") {
        const path = cwd ? `${cwd}/${raw}` : raw;
        const r = await authFetch(`/api/projects/${projectId}/files/folder`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, action: "create" }),
        });
        if (!r.ok) throw new Error();
        flash("Ordner erstellt");
      }
      setNamePrompt(null);
      await load();
    } catch { flash("Aktion fehlgeschlagen"); } finally { setBusy(false); }
  }, [namePrompt, cwd, authFetch, projectId, selected, load]);

  const deleteFolder = useCallback(async (folder: string) => {
    setConfirmFolderDel(null); setBusy(true);
    const full = cwd ? `${cwd}/${folder}` : folder;
    try {
      const r = await authFetch(`/api/projects/${projectId}/files/folder`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: full, action: "delete" }),
      });
      if (!r.ok) throw new Error();
      await load(); flash("Ordner gelöscht");
    } catch { flash("Löschen fehlgeschlagen"); } finally { setBusy(false); }
  }, [authFetch, projectId, cwd, load]);

  const crumbs = cwd ? cwd.split("/") : [];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--d-surface)" }}>
      <style>{`
        .gb-fx-body { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1.1fr); gap: 0; flex: 1; min-height: 0; }
        .gb-fx-preview { border-left: 1px solid var(--line); }
        @media (max-width: 820px) {
          .gb-fx-body { grid-template-columns: 1fr; }
          .gb-fx-list { display: ${selected ? "none" : "block"}; }
          .gb-fx-preview { display: ${selected ? "flex" : "none"}; border-left: none; }
        }
      `}</style>

      {/* Header + breadcrumb */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Link href={`/dashboard/project/${projectId}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-2)", textDecoration: "none", fontSize: 13 }}>
          <ArrowLeft size={16} /> {projectName}
        </Link>
        <span style={{ color: "var(--ink-3)" }}>/</span>
        <span style={{ fontWeight: 600, color: "var(--ink-1)", fontFamily: "var(--font-dash-display), Manrope, sans-serif" }}>Dateien</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setNamePrompt({ kind: "newfolder", value: "" })} disabled={busy} style={btnGhost} title="Neuer Ordner">
          <FolderPlus size={14} /> Ordner
        </button>
        <button onClick={() => setNamePrompt({ kind: "newfile", value: "" })} disabled={busy} style={btnGhost} title="Neue Datei">
          <FilePlus size={14} /> Datei
        </button>
        <button onClick={() => fileInput.current?.click()} disabled={busy} style={btnPrimary}>
          <Upload size={14} /> Hochladen
        </button>
        <input ref={fileInput} type="file" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
      </div>

      {/* Path breadcrumb */}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ink-2)", fontFamily: "JetBrains Mono, monospace", flexWrap: "wrap" }}>
        <button onClick={() => { setCwd(""); setSelected(null); setPreview(null); }} style={crumbBtn}>/ Projekt</button>
        {crumbs.map((seg, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ChevronRight size={12} style={{ color: "var(--ink-3)" }} />
            <button onClick={() => { setCwd(crumbs.slice(0, i + 1).join("/")); setSelected(null); setPreview(null); }} style={crumbBtn}>{seg}</button>
          </span>
        ))}
      </div>

      <div className="gb-fx-body">
        {/* LIST */}
        <div className="gb-fx-list" style={{ overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 24, color: "var(--ink-3)", fontSize: 13 }}>Lädt…</div>
          ) : folders.length === 0 && files.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>
              Dieser Ordner ist leer.<br />Lade oben rechts eine Datei hoch.
            </div>
          ) : (
            <div>
              {folders.map((f) => (
                <div key={"d" + f} style={row}>
                  <button onClick={() => { setCwd(cwd ? `${cwd}/${f}` : f); setSelected(null); setPreview(null); }} style={rowInner}>
                    <Folder size={17} style={{ color: "var(--gold)", flexShrink: 0 }} />
                    <span style={{ flex: 1, textAlign: "left", color: "var(--ink-1)", fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f}</span>
                    <ChevronRight size={15} style={{ color: "var(--ink-3)" }} />
                  </button>
                  <button onClick={() => setConfirmFolderDel(f)} title="Ordner löschen" style={{ ...iconBtn, color: "var(--danger)" }}><Trash2 size={14} /></button>
                </div>
              ))}
              {files.map((file) => {
                const name = file.path.split("/").pop() ?? file.path;
                const Ico = iconFor(name);
                const isSel = selected === file.path;
                return (
                  <div key={file.path} style={{ ...row, background: isSel ? "var(--d-surface-elev)" : "transparent" }}>
                    <button onClick={() => openFile(file.path)} style={{ ...rowInner }}>
                      <Ico size={17} style={{ color: "var(--ink-2)", flexShrink: 0 }} />
                      <span style={{ flex: 1, textAlign: "left", color: "var(--ink-1)", fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--ink-3)", flexShrink: 0 }}>{fmtSize(file.size)}</span>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--ink-3)", flexShrink: 0, minWidth: 64, textAlign: "right" }}>{ago(file.modified)}</span>
                    </button>
                    <button onClick={() => setNamePrompt({ kind: "rename", from: file.path, value: name })} title="Umbenennen / verschieben" style={iconBtn}><Pencil size={14} /></button>
                    <button onClick={() => download(file.path)} title="Herunterladen" style={iconBtn}><Download size={14} /></button>
                    <button onClick={() => setConfirmDel(file.path)} title="Löschen" style={{ ...iconBtn, color: "var(--danger)" }}><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* PREVIEW */}
        <div className="gb-fx-preview" style={{ flexDirection: "column", minHeight: 0, background: "var(--d-surface-elev)" }}>
          {!selected ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 13.5, padding: 24, textAlign: "center" }}>
              Wähle eine Datei zur Vorschau.
            </div>
          ) : (
            <>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, fontFamily: "JetBrains Mono, monospace", fontSize: 12.5, color: "var(--ink-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected}</span>
                <button onClick={() => download(selected)} title="Herunterladen" style={iconBtn}><Download size={15} /></button>
                <button onClick={() => { setSelected(null); setPreview(null); }} title="Schliessen" style={iconBtn}><X size={15} /></button>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                {preview?.kind === "text" ? (
                  <CodeEditor content={preview.text ?? ""} filename={selected} readOnly theme="light" />
                ) : preview?.kind === "image" ? (
                  <div style={{ padding: 20, display: "flex", justifyContent: "center" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview.dataUrl} alt={selected} style={{ maxWidth: "100%", height: "auto", borderRadius: 8, border: "1px solid var(--line)" }} />
                  </div>
                ) : preview ? (
                  <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>
                    Keine Vorschau für diesen Dateityp.<br />
                    <button onClick={() => download(selected)} style={{ ...btnPrimary, marginTop: 14 }}><Download size={14} /> Herunterladen</button>
                  </div>
                ) : (
                  <div style={{ padding: 24, color: "var(--ink-3)", fontSize: 13 }}>Lädt…</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {confirmDel && (
        <>
          <div onClick={() => setConfirmDel(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 90 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "var(--d-surface-elev)", border: "1px solid var(--line)", borderRadius: 14, padding: "22px 24px", zIndex: 91, minWidth: 300, maxWidth: 380 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-1)", marginBottom: 8, fontFamily: "var(--font-dash-display), Manrope, sans-serif" }}>Datei löschen?</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 18, wordBreak: "break-all" }}>{confirmDel}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDel(null)} style={btnGhost}>Abbrechen</button>
              <button onClick={() => doDelete(confirmDel)} style={{ ...btnPrimary, background: "var(--danger)" }}><Trash2 size={14} /> Löschen</button>
            </div>
          </div>
        </>
      )}

      {confirmFolderDel && (
        <>
          <div onClick={() => setConfirmFolderDel(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 90 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "var(--d-surface-elev)", border: "1px solid var(--line)", borderRadius: 14, padding: "22px 24px", zIndex: 91, minWidth: 300, maxWidth: 380 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-1)", marginBottom: 8, fontFamily: "var(--font-dash-display), Manrope, sans-serif" }}>Ordner löschen?</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 18, wordBreak: "break-all" }}>Alle Dateien in <strong>{confirmFolderDel}</strong> werden gelöscht.</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmFolderDel(null)} style={btnGhost}>Abbrechen</button>
              <button onClick={() => deleteFolder(confirmFolderDel)} style={{ ...btnPrimary, background: "var(--danger)" }}><Trash2 size={14} /> Löschen</button>
            </div>
          </div>
        </>
      )}

      {namePrompt && (
        <>
          <div onClick={() => setNamePrompt(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 90 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "var(--d-surface-elev)", border: "1px solid var(--line)", borderRadius: 14, padding: "22px 24px", zIndex: 91, minWidth: 320, maxWidth: 420 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-1)", marginBottom: 6, fontFamily: "var(--font-dash-display), Manrope, sans-serif" }}>
              {namePrompt.kind === "rename" ? "Umbenennen / verschieben" : namePrompt.kind === "newfolder" ? "Neuer Ordner" : "Neue Datei"}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 14 }}>
              {namePrompt.kind === "rename" ? "Name oder Pfad (z.B. src/app.ts zum Verschieben)." : `Wird in ${cwd || "/"} erstellt.`}
            </div>
            <input
              autoFocus value={namePrompt.value}
              onChange={(e) => setNamePrompt({ ...namePrompt, value: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") submitPrompt(); if (e.key === "Escape") setNamePrompt(null); }}
              placeholder={namePrompt.kind === "newfolder" ? "ordnername" : "datei.txt"}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--d-surface)", color: "var(--ink-1)", fontSize: 13.5, fontFamily: "JetBrains Mono, monospace", outline: "none", boxSizing: "border-box", marginBottom: 18 }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setNamePrompt(null)} style={btnGhost}>Abbrechen</button>
              <button onClick={submitPrompt} disabled={busy || !namePrompt.value.trim()} style={{ ...btnPrimary, opacity: !namePrompt.value.trim() ? 0.5 : 1 }}>Speichern</button>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "var(--green)", color: "#fff", padding: "9px 16px", borderRadius: 9, fontSize: 12.5, zIndex: 95 }}>{toast}</div>
      )}
    </div>
  );
}

const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--green)", color: "#fff", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" };
const btnGhost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid var(--line)", color: "var(--ink-2)", borderRadius: 9, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "var(--font-sans)" };
const crumbBtn: React.CSSProperties = { background: "transparent", border: "none", color: "var(--ink-2)", cursor: "pointer", fontFamily: "JetBrains Mono, monospace", fontSize: 12.5, padding: 0 };
const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 4, padding: "2px 12px 2px 18px", borderBottom: "1px solid var(--line)" };
const rowInner: React.CSSProperties = { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, padding: "10px 0", background: "transparent", border: "none", cursor: "pointer" };
const iconBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "var(--ink-2)", cursor: "pointer", padding: 6, flexShrink: 0 };
