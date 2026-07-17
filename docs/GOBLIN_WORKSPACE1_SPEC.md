# WORKSPACE-1 — Der Dateibereich als Arbeitsfläche
**Spec v1.0 · 2026-07-09 · Author: Steven · Design source for Wave C. Founder vision (verbatim intent): "nichts mehr lokal — Goblin ist der Arbeitsplatz."**

## 1. The idea
Max has no local file system worth the name — Goblin must be where his work *lives*, not just where it compiles. WORKSPACE-1 turns the existing Dateien section (folders/upload/zip already exist post-CHAT-IO) into a first-class **Explorer**: see the whole codebase, create and edit any file, start projects from files, and move fluidly between workspace ↔ chat ↔ agent. Mobile-first like everything since MOBILE-1 — the Explorer must feel like a native files app, not a web admin table.

## 2. Surface & interactions
- **Tree/list hybrid:** folders collapsible, files as rows (icon by type, name, size, modified). Mobile: full-screen surface reachable from project dashboard ("Explorer öffnen" exists) AND from the Code tab (same data, one component). Breadcrumb path. Pull-to-refresh.
- **Create:** "+ Neu" → Datei (name + extension, opens empty in the editor) / Ordner. Any text type (txt, md, html, css, js, json, csv). Templates: leer, md-Notiz, html-Seite.
- **Open:** text files → the MOBILE-1 Reader (read) with "Bearbeiten" → editor (Tier-3 component reused — one editor everywhere). Non-text: download card + honest "Vorschau für diesen Typ noch nicht" (no fake viewers).
- **Manage:** rename (UTF-8-safe), move (folder picker), duplicate, delete → `.trash/` (soft delete, consistent with existing semantics; Papierkorb view with restore + "endgültig löschen" using the batched purge from #18's fix — include that fix here, closing ticket #18).
- **Search/filter:** name filter instant; content search across text files (server-side, simple, results with snippet) — v1 may be name-only if content search exceeds one unit; say which shipped.
- **Selection mode:** long-press → multi-select → move/delete/download-zip.
- **From files to work:** per-file actions "Im Chat anhängen" (routes into the C2 attachment path) and "Goblin dazu fragen" (opens project chat with the file pre-attached). Per-folder "Neues Projekt hieraus" for the standalone/global workspace (see §3).

## 3. Scope decision: project workspace first, global second
v1 = the **project** Explorer (all storage primitives exist per project). A **global workspace** ("Meine Dateien" outside projects, create-project-from-folder) is the founder's fuller vision — architect the component so the data source is swappable, ship the global surface only if it fits within the wave's budget honestly; otherwise it is the named v1.1 with the component ready. No half-shipped global tab.

## 4. Consistency laws
Same file-card/Reader/editor components as chat and Code (no third rendering path) · `.trash/` never in agent context (B6 holds) · every destructive action confirm-dialoged, honest, batched · design tokens, dark mode, 375px-first · German+EN.

## 5. Non-goals (v1)
No realtime collab, no version-history UI (git/GitHub remains that story), no binary editing, no sharing/permissions, no WebDAV/sync. Named, parked.

## 6. Acceptance
A phone-only session must be able to: create a folder, create+edit+save an md file in it, attach it to chat, ask Goblin about it, rename it, trash it, restore it, download the project as zip — every step feeling native at 375px. That checklist IS the E2E gate.
