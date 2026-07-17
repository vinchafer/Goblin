"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  FileCode, FileJson, FileText, Image as ImageIcon, Palette, File as FileIcon,
  Folder, ChevronRight, Upload, Download, Trash2, ArrowLeft, X,
  Pencil, FolderPlus, FilePlus, MoreVertical, Copy, Share2, FolderInput, FolderSymlink, Code2, FileArchive, Search, RotateCcw, Files as FilesIcon, CheckCircle2,
} from "lucide-react";
import { API_URL, getToken } from "@/hooks/code/getToken";
import { useLang, t, type Lang } from "@/lib/use-lang";

// FW5-U3 (D-D): honest, localized per-failure upload errors. The server returns a
// distinct `error` code per guard (too_big / wrong_type / daily_cap / unsafe_path /
// storage_cap / storage_unavailable); the client maps each to a DE/EN message rather
// than the old catch-all "Upload fehlgeschlagen".
function uploadErrorMessage(code: string, lang: Lang, ext?: string): string {
  switch (code) {
    case "too_big": return t(lang, "Datei zu groß (max 10 MB). Bitte teile sie auf.", "File too large (max 10 MB). Please split it up.");
    case "wrong_type": return t(lang, `Dateityp${ext ? ` „.${ext}"` : ""} wird nicht unterstützt. Erlaubt: Text/Code, Bilder, PDF, Dokumente.`, `File type${ext ? ` ".${ext}"` : ""} isn't supported. Allowed: text/code, images, PDF, documents.`);
    case "daily_cap": return t(lang, "Tageslimit für Uploads erreicht — bitte morgen wieder.", "Daily upload limit reached — please try again tomorrow.");
    case "unsafe_path": return t(lang, "Ungültiger Ziel-Pfad — bitte in einen normalen Ordner laden.", "Invalid target path — please upload into a normal folder.");
    case "storage_cap": return t(lang, "Cloud-Speicher voll. Lösche etwas oder erweitere deinen Plan.", "Cloud storage is full. Delete something or upgrade your plan.");
    case "storage_unavailable": return t(lang, "Speicher gerade nicht erreichbar — gleich nochmal versuchen.", "Storage temporarily unavailable — please retry shortly.");
    case "empty_file": return t(lang, "Die Datei ist leer.", "The file is empty.");
    case "no_file": return t(lang, "Keine Datei empfangen.", "No file received.");
    default: return t(lang, "Upload fehlgeschlagen. Bitte nochmal versuchen.", "Upload failed. Please try again.");
  }
}

const CodeEditor = dynamic(
  () => import("@/components/editor/code-editor").then((m) => ({ default: m.CodeEditor })),
  { ssr: false, loading: () => <div style={{ padding: 24, color: "var(--ink-3)", fontFamily: "JetBrains Mono, monospace", fontSize: 13 }}>Vorschau lädt…</div> },
);

interface FileMeta {
  path: string; size: number; modified: string | null;
  // WS-B.2 — per-file timestamps from project_file_meta (migration 0066).
  // null until the migration is applied / for files created before tracking.
  createdAt?: string | null; lastPushedAt?: string | null;
}
// C-3: a Papierkorb entry as returned by GET /:id/trash. `originalPath` is the
// recovered path for restore; legacy (pre-Wave-C) entries carry null + legacy:true.
interface TrashEntry {
  trashPath: string; originalPath: string | null; deletedAt: number | null;
  legacy: boolean; size: number; modified: string | null;
}
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

// C-2: new-file templates. "leer" = empty; "md" = a Markdown note starter;
// "html" = a minimal, valid HTML5 skeleton. Content is UTF-8 (umlaut-safe).
type Template = "leer" | "md" | "html";
function templateContent(tpl: Template | undefined, filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  if (tpl === "md") return `# ${base}\n\n`;
  if (tpl === "html") return `<!doctype html>\n<html lang="de">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <title>${base}</title>\n</head>\n<body>\n  \n</body>\n</html>\n`;
  return "";
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kb`;
  return `${(n / 1024 / 1024).toFixed(1)} mb`;
}
// WS-B.2 — absolute short date for the Erstellt / Gepusht columns. Honest "—"
// when the value isn't tracked (no faked dates).
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "2-digit" });
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
  const lang = useLang();
  const [entries, setEntries] = useState<FileMeta[]>([]);
  const [dragOver, setDragOver] = useState(false);   // FW5-U3: drag-drop upload target
  const [loading, setLoading] = useState(true);
  const [cwd, setCwd] = useState("");                       // current folder, "" = root
  const [filter, setFilter] = useState("");                 // C-1: instant name filter (whole tree)
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ kind: "text" | "image" | "binary"; text?: string; dataUrl?: string } | null>(null);
  const [editing, setEditing] = useState(false);           // C-2: in-Explorer edit mode
  const [draft, setDraft] = useState("");                  // C-2: editable buffer
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [confirmFolderDel, setConfirmFolderDel] = useState<string | null>(null);
  // Name prompt for rename / new file / new folder (Slice 6).
  const [namePrompt, setNamePrompt] = useState<{ kind: "rename" | "newfile" | "newfolder"; from?: string; value: string; template?: Template } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // C-3: Papierkorb (trash) view.
  const [trashView, setTrashView] = useState(false);
  const [trashEntries, setTrashEntries] = useState<TrashEntry[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);   // WALK3-3.2: per-file ⋮ menu
  // WS-B.1: cross-project move picker — file path being moved + target list.
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const [projectList, setProjectList] = useState<{ id: string; name: string }[]>([]);
  const [moving, setMoving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Close the ⋮ menu on any outside click / escape.
  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuFor(null); };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", onKey); };
  }, [menuFor]);

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

  // C-1: instant name filter across the WHOLE tree. When a query is present the
  // folder view is replaced by a flat list of every file whose name (or path)
  // matches — so the filter doubles as a fast name search. Case-insensitive.
  const q = filter.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return [];
    return entries
      .filter((e) => {
        const name = (e.path.split("/").pop() ?? e.path).toLowerCase();
        return name.includes(q) || e.path.toLowerCase().includes(q);
      })
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [entries, q]);

  const openFile = useCallback(async (path: string) => {
    setSelected(path);
    setPreview(null);
    setEditing(false);
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

  // C-2: enter edit mode on the currently-previewed text file.
  const startEdit = useCallback(() => {
    if (preview?.kind === "text") { setDraft(preview.text ?? ""); setEditing(true); }
  }, [preview]);

  // C-2: save the draft back to the file via the direct project-file save endpoint
  // (PUT /:id/files/*). This is the one editor everywhere — the same CodeEditor the
  // Code tab uses — writing straight to project storage (distinct from the code-session
  // draft/deploy flow). Ctrl/Cmd-S in the editor also triggers this.
  const saveEdit = useCallback(async (content?: string) => {
    if (!selected) return;
    const body = content ?? draft;
    setSaving(true);
    try {
      const r = await authFetch(`/api/projects/${projectId}/files/${selected.split("/").map(encodeURIComponent).join("/")}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: body }),
      });
      if (!r.ok) throw new Error();
      setPreview({ kind: "text", text: body });
      setEditing(false);
      flash(t(lang, "Gespeichert", "Saved"));
      load();
    } catch { flash(t(lang, "Speichern fehlgeschlagen", "Save failed")); } finally { setSaving(false); }
  }, [authFetch, projectId, selected, draft, load, lang]);

  // WS-B.1: open the cross-project move picker — load the user's OTHER projects.
  const openMovePicker = useCallback(async (path: string) => {
    setMoveFor(path);
    setProjectList([]);
    try {
      const r = await authFetch(`/api/projects`);
      const d = await r.json();
      const list = Array.isArray(d) ? d : (d?.projects ?? []);
      setProjectList(
        list.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
          .filter((p: { id: string }) => p.id !== projectId),
      );
    } catch { setProjectList([]); }
  }, [authFetch, projectId]);

  // WS-B.1: copy the file into the target project, then remove it here (server
  // copies-then-deletes; 409 = name clash in the target).
  const moveToProject = useCallback(async (toProjectId: string) => {
    if (!moveFor) return;
    setMoving(true);
    try {
      const r = await authFetch(`/api/projects/${projectId}/files/move-to-project`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: moveFor, toProjectId }),
      });
      if (r.status === 409) { flash("Zielprojekt hat schon eine Datei mit diesem Namen"); return; }
      if (!r.ok) { flash("Verschieben fehlgeschlagen"); return; }
      flash("Datei verschoben");
      if (selected === moveFor) { setSelected(null); setPreview(null); }
      setMoveFor(null);
      load();
    } catch { flash("Verschieben fehlgeschlagen"); } finally { setMoving(false); }
  }, [authFetch, projectId, moveFor, selected, load]);

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

  // C4b: download the whole project as a ZIP (server streams the project prefix,
  // excluding .trash/). Reuses the existing GET /:id/download endpoint.
  const [zipping, setZipping] = useState(false);
  const downloadZip = useCallback(async () => {
    setZipping(true);
    try {
      const r = await authFetch(`/api/projects/${projectId}/download`);
      if (!r.ok) { flash("Download fehlgeschlagen"); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${(projectName || "projekt").replace(/[^\w.-]+/g, "-")}.zip`; a.click();
      URL.revokeObjectURL(url);
    } catch { flash("Download fehlgeschlagen"); } finally { setZipping(false); }
  }, [authFetch, projectId, projectName]);

  // WALK3-3.2: fetch a text file's content (for copy / share). Returns null for
  // non-text or on error.
  const fetchText = useCallback(async (path: string): Promise<string | null> => {
    if (!TEXT_EXT.has(ext(path))) return null;
    try {
      const r = await authFetch(`/api/projects/${projectId}/files/${path.split("/").map(encodeURIComponent).join("/")}`);
      const d = await r.json();
      return typeof d.content === "string" ? d.content : null;
    } catch { return null; }
  }, [authFetch, projectId]);

  const copyContent = useCallback(async (path: string) => {
    const text = await fetchText(path);
    if (text == null) { flash("Nur Textdateien können kopiert werden"); return; }
    try { await navigator.clipboard.writeText(text); flash("Inhalt kopiert"); }
    catch { flash("Kopieren fehlgeschlagen"); }
  }, [fetchText]);

  const shareFile = useCallback(async (path: string) => {
    const name = path.split("/").pop() ?? path;
    const text = await fetchText(path);
    // Prefer the native share sheet (mobile); fall back to clipboard.
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string }) => Promise<void> };
    if (nav.share) {
      try { await nav.share({ title: name, text: text ?? name }); return; } catch { /* cancelled */ return; }
    }
    if (text != null) { try { await navigator.clipboard.writeText(text); flash("Zum Teilen kopiert"); return; } catch { /* */ } }
    flash("Teilen wird hier nicht unterstützt");
  }, [fetchText]);

  const doDelete = useCallback(async (path: string) => {
    setConfirmDel(null); setBusy(true);
    try {
      await authFetch(`/api/projects/${projectId}/files/${path.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE" });
      if (selected === path) { setSelected(null); setPreview(null); }
      await load(); flash("Gelöscht");
    } catch { flash("Löschen fehlgeschlagen"); } finally { setBusy(false); }
  }, [authFetch, projectId, selected, load]);

  const onUpload = useCallback(async (file: File) => {
    // Instant size feedback client-side; the server is the authority for type + the rest.
    if (file.size > 10 * 1024 * 1024) { flash(uploadErrorMessage("too_big", lang)); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("path", cwd);
      const r = await authFetch(`/api/projects/${projectId}/files/upload`, { method: "POST", body: fd });
      if (!r.ok) {
        let code = "", ext: string | undefined;
        try { const j = await r.json(); code = j?.error ?? ""; ext = j?.ext; } catch { /* non-JSON */ }
        flash(uploadErrorMessage(code, lang, ext));
        return;
      }
      await load(); flash(t(lang, `${file.name} hochgeladen`, `${file.name} uploaded`));
    } catch { flash(uploadErrorMessage("", lang)); } finally { setBusy(false); }
  }, [authFetch, projectId, cwd, load, lang]);

  // FW5-U3: drag-drop upload. Dropping files anywhere in the explorer uploads them into
  // the current folder, one at a time through the same hardened onUpload path.
  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    for (const f of files) await onUpload(f);
  }, [onUpload]);

  // ── Slice 6 ops: rename/move, new file, new folder, folder delete ──
  const submitPrompt = useCallback(async () => {
    if (!namePrompt) return;
    const raw = namePrompt.value.trim();
    if (!raw) return;
    setBusy(true);
    // C-2: when a new file is created, open it straight in the editor (seeded by template).
    let openAfter: { path: string; content: string } | null = null;
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
        const content = templateContent(namePrompt.template, raw);
        const r = await authFetch(`/api/projects/${projectId}/files`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, content }),
        });
        if (!r.ok) throw new Error();
        openAfter = { path, content };
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
      if (openAfter) {
        // Open the freshly-created file directly in the editor (spec §2: "opens empty
        // in the editor"). Skip the fetch — we already know the seeded content.
        setSelected(openAfter.path);
        setPreview({ kind: "text", text: openAfter.content });
        setDraft(openAfter.content);
        setEditing(true);
      }
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

  // ── C-3: Papierkorb (trash) ops ──
  const fetchTrash = useCallback(async () => {
    setTrashLoading(true);
    try {
      const r = await authFetch(`/api/projects/${projectId}/trash`);
      const d = await r.json();
      setTrashEntries(Array.isArray(d.entries) ? d.entries : []);
    } catch { setTrashEntries([]); } finally { setTrashLoading(false); }
  }, [authFetch, projectId]);

  const openTrash = useCallback(() => { setTrashView(true); setSelected(null); setPreview(null); setEditing(false); fetchTrash(); }, [fetchTrash]);

  const restoreTrashed = useCallback(async (entry: TrashEntry) => {
    setBusy(true);
    try {
      const r = await authFetch(`/api/projects/${projectId}/files/restore`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trashPath: entry.trashPath }),
      });
      if (r.status === 409) { flash(t(lang, "Es existiert schon eine Datei an diesem Pfad", "A file already exists at that path")); return; }
      if (!r.ok) { flash(t(lang, "Wiederherstellen fehlgeschlagen", "Restore failed")); return; }
      flash(t(lang, "Wiederhergestellt", "Restored"));
      await fetchTrash();
      load();
    } catch { flash(t(lang, "Wiederherstellen fehlgeschlagen", "Restore failed")); } finally { setBusy(false); }
  }, [authFetch, projectId, fetchTrash, load, lang]);

  const purgeTrash = useCallback(async () => {
    setConfirmPurge(false); setBusy(true);
    try {
      const r = await authFetch(`/api/projects/${projectId}/files/purge-trash`, { method: "POST" });
      if (!r.ok) throw new Error();
      flash(t(lang, "Papierkorb geleert", "Trash emptied"));
      await fetchTrash();
      load();
    } catch { flash(t(lang, "Leeren fehlgeschlagen", "Emptying failed")); } finally { setBusy(false); }
  }, [authFetch, projectId, fetchTrash, load, lang]);

  // C-3: duplicate a file to a non-colliding "<name>-kopie" path. Text goes through
  // POST /:id/files; binary is re-uploaded through the hardened multipart chain.
  const duplicateFile = useCallback(async (path: string) => {
    setBusy(true);
    try {
      const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      const baseName = path.split("/").pop() ?? path;
      const dot = baseName.lastIndexOf(".");
      const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
      const extPart = dot > 0 ? baseName.slice(dot) : "";
      const existing = new Set(entries.map((e) => e.path));
      let n = 0, copyPath = "";
      do {
        const suffix = n === 0 ? "-kopie" : `-kopie-${n + 1}`;
        copyPath = `${dir ? dir + "/" : ""}${stem}${suffix}${extPart}`;
        n++;
      } while (existing.has(copyPath));

      if (TEXT_EXT.has(ext(path))) {
        const text = await fetchText(path);
        const r = await authFetch(`/api/projects/${projectId}/files`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: copyPath, content: text ?? "" }),
        });
        if (!r.ok) throw new Error();
      } else {
        const raw = await authFetch(`/api/projects/${projectId}/files-raw/${path.split("/").map(encodeURIComponent).join("/")}`);
        const d = await raw.json();
        const bin = atob(d.base64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const fd = new FormData();
        fd.append("file", new File([arr], copyPath.split("/").pop() ?? "kopie", { type: d.contentType }));
        fd.append("path", dir);
        const r = await authFetch(`/api/projects/${projectId}/files/upload`, { method: "POST", body: fd });
        if (!r.ok) { let code = ""; try { code = (await r.json())?.error ?? ""; } catch { /* */ } flash(uploadErrorMessage(code, lang)); return; }
      }
      await load(); flash(t(lang, "Dupliziert", "Duplicated"));
    } catch { flash(t(lang, "Duplizieren fehlgeschlagen", "Duplicate failed")); } finally { setBusy(false); }
  }, [entries, fetchText, authFetch, projectId, load, lang]);

  // ── C-3: long-press multi-select ──
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLongPress = useCallback((path: string) => {
    lpTimer.current = setTimeout(() => {
      setSelectMode(true);
      setChecked((prev) => new Set(prev).add(path));
      lpTimer.current = null;
    }, 500);
  }, []);
  const cancelLongPress = useCallback(() => {
    if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; }
  }, []);
  const toggleCheck = useCallback((path: string) => {
    setChecked((prev) => { const n = new Set(prev); if (n.has(path)) n.delete(path); else n.add(path); return n; });
  }, []);
  const exitSelect = useCallback(() => { setSelectMode(false); setChecked(new Set()); }, []);

  const batchDelete = useCallback(async () => {
    const paths = [...checked];
    if (paths.length === 0) return;
    setBusy(true);
    try {
      for (const p of paths) {
        await authFetch(`/api/projects/${projectId}/files/${p.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE" });
      }
      if (selected && paths.includes(selected)) { setSelected(null); setPreview(null); }
      exitSelect(); await load(); flash(t(lang, `${paths.length} gelöscht`, `${paths.length} deleted`));
    } catch { flash(t(lang, "Löschen fehlgeschlagen", "Delete failed")); } finally { setBusy(false); }
  }, [checked, authFetch, projectId, selected, exitSelect, load, lang]);

  const batchDownload = useCallback(async () => {
    for (const p of [...checked]) { await download(p); }
  }, [checked, download]);

  const crumbs = cwd ? cwd.split("/") : [];

  return (
    <div
      style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", background: "var(--d-surface)" }}
      onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
      onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={onDrop}
    >
      {/* FW5-U3: drag-drop overlay — honest hint, shown only while dragging files over. */}
      {dragOver && (
        <div style={{
          position: "absolute", inset: 8, zIndex: 80, borderRadius: 14,
          border: "2px dashed var(--green)", background: "rgba(0,0,0,0.04)",
          display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none",
          color: "var(--ink-1)", fontSize: 15, fontWeight: 600, fontFamily: "var(--font-sans)", textAlign: "center", padding: 24,
        }}>
          <span><Upload size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />{t(lang, "Dateien hier ablegen zum Hochladen", "Drop files here to upload")}</span>
        </div>
      )}
      <style>{`
        .gb-fx-body { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1.1fr); gap: 0; flex: 1; min-height: 0; }
        .gb-fx-preview { border-left: 1px solid var(--line); }
        /* WS-B.2: Erstellt + Gepusht columns are space-hungry — show them only
           when the list pane is wide (desktop review), hide when cramped. */
        @media (max-width: 1200px) { .gb-fx-col-created, .gb-fx-col-pushed { display: none !important; } }
        @media (max-width: 560px) { .gb-fx-col-size { display: none !important; } }
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
        <button onClick={downloadZip} disabled={busy || zipping} style={btnGhost} title="Projekt als ZIP herunterladen" data-testid="download-zip">
          <FileArchive size={14} /> {zipping ? "…" : "ZIP"}
        </button>
        <button onClick={openTrash} disabled={busy} style={btnGhost} title={t(lang, "Papierkorb", "Trash")} data-testid="open-trash">
          <Trash2 size={14} /> {t(lang, "Papierkorb", "Trash")}
        </button>
        <button onClick={() => fileInput.current?.click()} disabled={busy} style={btnPrimary}>
          <Upload size={14} /> {t(lang, "Hochladen", "Upload")}
        </button>
        <input ref={fileInput} type="file" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
      </div>

      {/* Path breadcrumb + C-1 name filter */}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ink-2)", fontFamily: "JetBrains Mono, monospace", flexWrap: "wrap" }}>
        <button onClick={() => { setCwd(""); setSelected(null); setPreview(null); }} style={crumbBtn}>/ Projekt</button>
        {crumbs.map((seg, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ChevronRight size={12} style={{ color: "var(--ink-3)" }} />
            <button onClick={() => { setCwd(crumbs.slice(0, i + 1).join("/")); setSelected(null); setPreview(null); }} style={crumbBtn}>{seg}</button>
          </span>
        ))}
        <div style={{ flex: 1, minWidth: 12 }} />
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", borderRadius: 8, padding: "5px 9px", background: "var(--d-surface-elev)", minWidth: 0 }}>
          <Search size={13} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setFilter(""); }}
            placeholder={t(lang, "Dateien filtern…", "Filter files…")}
            aria-label={t(lang, "Dateien nach Name filtern", "Filter files by name")}
            data-testid="fx-filter"
            style={{ border: "none", outline: "none", background: "transparent", color: "var(--ink-1)", fontSize: 12.5, fontFamily: "var(--font-sans)", width: 150, maxWidth: "40vw", minWidth: 0 }}
          />
          {filter && (
            <button onClick={() => setFilter("")} title={t(lang, "Filter löschen", "Clear filter")} aria-label={t(lang, "Filter löschen", "Clear filter")} style={{ ...iconBtn, padding: 0 }}><X size={13} /></button>
          )}
        </div>
      </div>

      {/* C-3: Papierkorb view — replaces the browser while open. */}
      {trashView && (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "var(--d-surface)" }}>
          <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setTrashView(false)} style={{ ...btnGhost }}><ArrowLeft size={14} /> {t(lang, "Zurück", "Back")}</button>
            <span style={{ fontWeight: 600, color: "var(--ink-1)", fontFamily: "var(--font-dash-display), Manrope, sans-serif" }}>{t(lang, "Papierkorb", "Trash")}</span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setConfirmPurge(true)}
              disabled={busy || trashEntries.length === 0}
              style={{ ...btnGhost, color: "var(--danger)", borderColor: "var(--danger)", opacity: trashEntries.length === 0 ? 0.5 : 1 }}
              data-testid="purge-trash"
            ><Trash2 size={14} /> {t(lang, "Endgültig löschen", "Delete permanently")}</button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {trashLoading ? (
              <div style={{ padding: 24, color: "var(--ink-3)", fontSize: 13 }}>Lädt…</div>
            ) : trashEntries.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>
                {t(lang, "Der Papierkorb ist leer.", "The trash is empty.")}
              </div>
            ) : (
              <div>
                {trashEntries.map((e) => {
                  const shownName = (e.originalPath ?? e.trashPath).split("/").pop() ?? e.trashPath;
                  const Ico = iconFor(shownName);
                  return (
                    <div key={e.trashPath} style={row}>
                      <div style={{ ...rowInner, cursor: "default" }}>
                        <Ico size={17} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                          <span style={{ display: "block", color: "var(--ink-1)", fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shownName}</span>
                          <span style={{ display: "block", color: "var(--ink-3)", fontSize: 11, fontFamily: "JetBrains Mono, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {e.legacy ? t(lang, "älterer Papierkorb — nicht automatisch wiederherstellbar", "older trash — not auto-restorable") : (e.originalPath ?? "")}
                          </span>
                        </span>
                        <span style={{ ...colCell, width: 60 }}>{fmtSize(e.size)}</span>
                      </div>
                      <button
                        onClick={() => restoreTrashed(e)}
                        disabled={busy || e.legacy}
                        title={e.legacy ? t(lang, "Nicht automatisch wiederherstellbar", "Not auto-restorable") : t(lang, "Wiederherstellen", "Restore")}
                        style={{ ...btnGhost, padding: "6px 10px", fontSize: 12.5, opacity: e.legacy ? 0.5 : 1 }}
                        data-testid="restore-file"
                      ><RotateCcw size={13} /> {t(lang, "Wiederherstellen", "Restore")}</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="gb-fx-body" style={{ display: trashView ? "none" : undefined }}>
        {/* LIST */}
        <div className="gb-fx-list" style={{ overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 24, color: "var(--ink-3)", fontSize: 13 }}>Lädt…</div>
          ) : q ? (
            // C-1 filter mode: flat, whole-tree name matches (folders bypassed).
            filtered.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>
                {t(lang, `Keine Datei passt zu „${filter}".`, `No file matches "${filter}".`)}
              </div>
            ) : (
              <div>
                {filtered.map((file) => {
                  const name = file.path.split("/").pop() ?? file.path;
                  const Ico = iconFor(name);
                  const isSel = selected === file.path;
                  const dir = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "";
                  return (
                    <div key={"f" + file.path} style={{ ...row, position: "relative", background: isSel ? "var(--d-surface-elev)" : "transparent" }}>
                      <button onClick={() => openFile(file.path)} style={rowInner}>
                        <Ico size={17} style={{ color: "var(--ink-2)", flexShrink: 0 }} />
                        <span style={{ flex: 1, textAlign: "left", minWidth: 0, overflow: "hidden" }}>
                          <span style={{ display: "block", color: "var(--ink-1)", fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                          {dir && <span style={{ display: "block", color: "var(--ink-3)", fontSize: 11, fontFamily: "JetBrains Mono, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dir}/</span>}
                        </span>
                        <span className="gb-fx-col-size" style={{ ...colCell, width: 60 }}>{fmtSize(file.size)}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : folders.length === 0 && files.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>
              {t(lang, "Dieser Ordner ist leer.", "This folder is empty.")}<br />{t(lang, "Lade oben rechts eine Datei hoch — oder zieh sie hierher.", "Upload a file top-right — or drag it here.")}
            </div>
          ) : (
            <div>
              {/* WS-B.2: real per-file Erstellt + Zuletzt gepusht columns, backed by
                  project_file_meta (migration 0066). Untracked files show "—". */}
              <div style={{ ...row, position: "sticky", top: 0, zIndex: 1, background: "var(--d-surface)", borderBottom: "1px solid var(--line)" }}>
                <div style={{ ...rowInner, padding: "8px 0", cursor: "default" }}>
                  <span style={{ width: 17, flexShrink: 0 }} />
                  <span style={{ flex: 1, textAlign: "left", ...colHead }}>Name</span>
                  <span className="gb-fx-col-created" style={{ width: 80, textAlign: "right", ...colHead }}>Erstellt</span>
                  <span className="gb-fx-col-pushed" style={{ width: 84, textAlign: "right", ...colHead }}>Gepusht</span>
                  <span className="gb-fx-col-size" style={{ width: 60, textAlign: "right", ...colHead }}>Grösse</span>
                  <span style={{ width: 88, textAlign: "right", ...colHead }}>Bearbeitet</span>
                </div>
                <span style={{ width: 28, flexShrink: 0 }} />
              </div>
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
                const isChecked = checked.has(file.path);
                return (
                  <div key={file.path} style={{ ...row, position: "relative", background: isChecked ? "var(--d-surface-elev)" : isSel ? "var(--d-surface-elev)" : "transparent" }}>
                    <button
                      onClick={() => (selectMode ? toggleCheck(file.path) : openFile(file.path))}
                      onPointerDown={() => startLongPress(file.path)}
                      onPointerUp={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      style={{ ...rowInner }}
                    >
                      {selectMode && (
                        <CheckCircle2 size={17} style={{ color: isChecked ? "var(--green)" : "var(--ink-3)", flexShrink: 0, opacity: isChecked ? 1 : 0.5 }} />
                      )}
                      <Ico size={17} style={{ color: "var(--ink-2)", flexShrink: 0 }} />
                      <span style={{ flex: 1, textAlign: "left", color: "var(--ink-1)", fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                      <span className="gb-fx-col-created" style={{ ...colCell, width: 80 }} title={file.createdAt ? new Date(file.createdAt).toLocaleString("de-CH") : "nicht erfasst"}>{fmtDate(file.createdAt)}</span>
                      <span className="gb-fx-col-pushed" style={{ ...colCell, width: 84 }} title={file.lastPushedAt ? new Date(file.lastPushedAt).toLocaleString("de-CH") : "noch nicht gepusht"}>{fmtDate(file.lastPushedAt)}</span>
                      <span className="gb-fx-col-size" style={{ ...colCell, width: 60 }}>{fmtSize(file.size)}</span>
                      <span className="gb-fx-col-mod" style={{ ...colCell, width: 88 }}>{ago(file.modified)}</span>
                    </button>
                    {/* WALK3-3.2: per-file overflow menu (was: 3 fixed icons). */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === file.path ? null : file.path); }}
                      title="Aktionen" aria-label="Datei-Aktionen" style={iconBtn}
                    ><MoreVertical size={16} /></button>
                    {menuFor === file.path && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        role="menu"
                        style={{
                          position: "absolute", top: "100%", right: 12, zIndex: 70, minWidth: 210,
                          background: "var(--d-surface-elev)", border: "1px solid var(--line)", borderRadius: 10,
                          boxShadow: "0 12px 32px rgba(0,0,0,0.18)", padding: 5,
                        }}
                      >
                        <Link href={`/dashboard/project/${projectId}/work?tab=code&file=${encodeURIComponent(file.path)}`} style={menuItem} role="menuitem"><Code2 size={14} /> Im Editor öffnen</Link>
                        <button onClick={() => { setMenuFor(null); duplicateFile(file.path); }} style={menuItem} role="menuitem"><FilesIcon size={14} /> {t(lang, "Duplizieren", "Duplicate")}</button>
                        <button onClick={() => { setMenuFor(null); copyContent(file.path); }} style={menuItem} role="menuitem"><Copy size={14} /> Kopieren</button>
                        <button onClick={() => { setMenuFor(null); shareFile(file.path); }} style={menuItem} role="menuitem"><Share2 size={14} /> Teilen</button>
                        <button onClick={() => { setMenuFor(null); setNamePrompt({ kind: "rename", from: file.path, value: name }); }} style={menuItem} role="menuitem"><Pencil size={14} /> Umbenennen</button>
                        <button onClick={() => { setMenuFor(null); setNamePrompt({ kind: "rename", from: file.path, value: file.path }); }} style={menuItem} role="menuitem" title="Pfad bearbeiten = in einen Ordner verschieben"><FolderInput size={14} /> Verschieben</button>
                        <button onClick={() => { setMenuFor(null); openMovePicker(file.path); }} style={menuItem} role="menuitem" title="In ein anderes Projekt verschieben"><FolderSymlink size={14} /> In anderes Projekt</button>
                        <button onClick={() => { setMenuFor(null); download(file.path); }} style={menuItem} role="menuitem"><Download size={14} /> Download</button>
                        <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
                        <button onClick={() => { setMenuFor(null); setConfirmDel(file.path); }} style={{ ...menuItem, color: "var(--danger)" }} role="menuitem"><Trash2 size={14} /> Löschen</button>
                      </div>
                    )}
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
                <span style={{ flex: 1, minWidth: 0, fontFamily: "JetBrains Mono, monospace", fontSize: 12.5, color: "var(--ink-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected}{editing && <span style={{ color: "var(--gold)" }}> ●</span>}</span>
                {preview?.kind === "text" && !editing && (
                  <button onClick={startEdit} title={t(lang, "Bearbeiten", "Edit")} data-testid="fx-edit" style={btnGhost}><Pencil size={14} /> {t(lang, "Bearbeiten", "Edit")}</button>
                )}
                {editing && (
                  <>
                    <button onClick={() => setEditing(false)} title={t(lang, "Verwerfen", "Discard")} style={btnGhost}>{t(lang, "Verwerfen", "Discard")}</button>
                    <button onClick={() => saveEdit()} disabled={saving} title={t(lang, "Speichern", "Save")} data-testid="fx-save" style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? "…" : t(lang, "Speichern", "Save")}</button>
                  </>
                )}
                {!editing && <button onClick={() => download(selected)} title="Herunterladen" style={iconBtn}><Download size={15} /></button>}
                <button onClick={() => { setSelected(null); setPreview(null); setEditing(false); }} title="Schliessen" style={iconBtn}><X size={15} /></button>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                {preview?.kind === "text" ? (
                  editing ? (
                    <CodeEditor content={draft} filename={selected} theme="light" onChange={setDraft} onSave={(c) => saveEdit(c)} />
                  ) : (
                    <CodeEditor content={preview.text ?? ""} filename={selected} readOnly theme="light" />
                  )
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

      {/* WS-B.1: cross-project move picker */}
      {moveFor && (
        <>
          <div onClick={() => { if (!moving) setMoveFor(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 90 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "var(--d-surface-elev)", border: "1px solid var(--line)", borderRadius: 14, padding: "22px 24px", zIndex: 91, minWidth: 320, maxWidth: 420, width: "90%" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-1)", marginBottom: 6, fontFamily: "var(--font-dash-display), Manrope, sans-serif" }}>In anderes Projekt verschieben</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 16, wordBreak: "break-all" }}>
              <span style={{ fontFamily: "JetBrains Mono, monospace" }}>{moveFor}</span> in ein anderes Projekt verschieben. Die Datei wird zuerst kopiert und erst dann hier entfernt.
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
              {projectList.length === 0 ? (
                <div style={{ padding: 16, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Kein anderes Projekt vorhanden.</div>
              ) : projectList.map((p) => (
                <button key={p.id} disabled={moving} onClick={() => moveToProject(p.id)}
                  style={{ ...menuItem, padding: "11px 12px", border: "1px solid var(--line)", opacity: moving ? 0.5 : 1 }}>
                  <FolderSymlink size={15} style={{ color: "var(--gold)" }} /> {p.name}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setMoveFor(null)} disabled={moving} style={btnGhost}>Abbrechen</button>
            </div>
          </div>
        </>
      )}

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

      {confirmPurge && (
        <>
          <div onClick={() => setConfirmPurge(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 90 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "var(--d-surface-elev)", border: "1px solid var(--line)", borderRadius: 14, padding: "22px 24px", zIndex: 91, minWidth: 300, maxWidth: 380 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-1)", marginBottom: 8, fontFamily: "var(--font-dash-display), Manrope, sans-serif" }}>{t(lang, "Papierkorb endgültig leeren?", "Empty trash permanently?")}</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 18 }}>{t(lang, "Alle Dateien im Papierkorb werden unwiderruflich gelöscht und der Speicher wird freigegeben.", "All files in the trash are permanently deleted and their storage is freed.")}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmPurge(false)} style={btnGhost}>{t(lang, "Abbrechen", "Cancel")}</button>
              <button onClick={purgeTrash} style={{ ...btnPrimary, background: "var(--danger)" }}><Trash2 size={14} /> {t(lang, "Endgültig löschen", "Delete permanently")}</button>
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
            {namePrompt.kind === "newfile" && (
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {([
                  { key: "leer" as Template, label: t(lang, "Leer", "Empty"), ext: "" },
                  { key: "md" as Template, label: "Markdown", ext: ".md" },
                  { key: "html" as Template, label: "HTML", ext: ".html" },
                ]).map((tpl) => {
                  const active = (namePrompt.template ?? "leer") === tpl.key;
                  return (
                    <button
                      key={tpl.key}
                      onClick={() => {
                        const cur = namePrompt.value.trim();
                        const hasExt = /\.[^.]+$/.test(cur);
                        const base = cur.replace(/\.[^.]+$/, "");
                        const value = tpl.ext && !hasExt ? `${base || (tpl.key === "md" ? "notiz" : "seite")}${tpl.ext}` : cur;
                        setNamePrompt({ ...namePrompt, template: tpl.key, value });
                      }}
                      style={{
                        ...btnGhost, padding: "6px 12px", fontSize: 12.5,
                        borderColor: active ? "var(--green)" : "var(--line)",
                        color: active ? "var(--green)" : "var(--ink-2)",
                        background: active ? "rgba(127,169,138,0.10)" : "transparent",
                      }}
                    >{tpl.label}</button>
                  );
                })}
              </div>
            )}
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

      {/* C-3: multi-select action bar (long-press to enter). Batch delete + download
          reuse the per-file endpoints; batch move / zip-of-selection are v1.1. */}
      {selectMode && (
        <div style={{
          position: "fixed", bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", left: "50%", transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: 10, background: "var(--d-surface-elev)", border: "1px solid var(--line)",
          borderRadius: 12, padding: "9px 12px", zIndex: 94, boxShadow: "0 12px 32px rgba(0,0,0,0.22)", maxWidth: "calc(100vw - 24px)", flexWrap: "wrap",
        }} data-testid="select-bar">
          <span style={{ fontSize: 13, color: "var(--ink-1)", fontWeight: 600 }}>{t(lang, `${checked.size} ausgewählt`, `${checked.size} selected`)}</span>
          <button onClick={batchDownload} disabled={busy || checked.size === 0} style={{ ...btnGhost, padding: "7px 11px", opacity: checked.size === 0 ? 0.5 : 1 }}><Download size={14} /> {t(lang, "Download", "Download")}</button>
          <button onClick={batchDelete} disabled={busy || checked.size === 0} style={{ ...btnGhost, padding: "7px 11px", color: "var(--danger)", borderColor: "var(--danger)", opacity: checked.size === 0 ? 0.5 : 1 }}><Trash2 size={14} /> {t(lang, "Löschen", "Delete")}</button>
          <button onClick={exitSelect} style={{ ...btnGhost, padding: "7px 11px" }}>{t(lang, "Fertig", "Done")}</button>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: "calc(20px + env(safe-area-inset-bottom, 0px))", left: "50%", transform: "translateX(-50%)", background: "var(--green)", color: "#fff", padding: "9px 16px", borderRadius: 9, fontSize: 12.5, zIndex: 95 }}>{toast}</div>
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
const menuItem: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", background: "transparent", border: "none", color: "var(--ink-1)", cursor: "pointer", padding: "9px 11px", fontSize: 13, fontFamily: "var(--font-sans)", borderRadius: 7, textDecoration: "none", boxSizing: "border-box" };
// WS-B.2 explorer column styles.
const colHead: React.CSSProperties = { fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3)", flexShrink: 0 };
const colCell: React.CSSProperties = { fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--ink-3)", flexShrink: 0, textAlign: "right" };
