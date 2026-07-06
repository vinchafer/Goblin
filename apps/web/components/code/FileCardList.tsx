"use client";

// MOBILE-1 · M2 — the file list as cards (spec §2.3).
//
// Same visual language as the chat file-cards: name · language · line count,
// plus a state badge: GEÄNDERT (+n −m) amber / NEU green / unchanged (none).
// Cards with pending changes float to the top (review is the default). Tapping a
// GEÄNDERT card opens the Diff sheet first; tapping an unchanged/NEU card opens
// the Reader. A simple filter field narrows the list by path.
//
// Change state is computed against the project's SAVED files (the base map),
// since a reloaded draft row no longer carries its pre-edit base. A draft with
// no saved base = NEU; a draft that differs from its base = GEÄNDERT; identical
// or non-draft = unchanged.

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { classifyFile, lineDelta } from "@/lib/file-compare";
import { useLang, t } from "@/lib/use-lang";
import type { SessionFile } from "@/hooks/code/useCodeSessionDetail";

export type CardStatus = "changed" | "new" | "none";

export interface FileCardInfo {
  path: string;
  lang: string;
  lines: number;
  status: CardStatus;
  added: number;
  removed: number;
}

function langOf(path: string): string {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  const map: Record<string, string> = {
    html: "HTML", htm: "HTML", css: "CSS", scss: "SCSS",
    js: "JavaScript", mjs: "JavaScript", cjs: "JavaScript", ts: "TypeScript",
    jsx: "JSX", tsx: "TSX", json: "JSON", md: "Markdown",
    py: "Python", sh: "Shell", yaml: "YAML", yml: "YAML", svg: "SVG", txt: "Text",
  };
  return map[ext] ?? (ext ? ext.toUpperCase() : "Datei");
}

/**
 * Classify one session file against the saved base map. Exported for tests.
 *
 * P1.7: `unknownBase` carries paths whose saved base could NOT be fetched (e.g. a
 * 429 that survived retries). Such a file has an *unknown* base, not an absent one
 * — so we must NOT assert a confident NEU badge on it (that was the mislabel bug:
 * 429 → no base → permanent NEU). Absent-from-base still means genuinely new.
 */
export function classifyCard(
  file: SessionFile,
  baseFiles: Record<string, string>,
  unknownBase?: ReadonlySet<string>,
): FileCardInfo {
  const lines = file.content ? file.content.split("\n").length : 0;
  const base = baseFiles[file.path];
  let status: CardStatus = "none";
  let added = 0, removed = 0;
  if (file.change_state === "draft") {
    // Base unknown (fetch failed) → don't assert NEU; render a neutral card.
    if (base === undefined && unknownBase?.has(file.path)) {
      return { path: file.path, lang: langOf(file.path), lines, status: "none", added, removed };
    }
    const cls = classifyFile(base ?? null, file.content);
    if (cls === "new") status = "new";
    else if (cls === "changed") {
      status = "changed";
      const d = lineDelta(base ?? "", file.content);
      added = d.added; removed = d.removed;
    }
  }
  return { path: file.path, lang: langOf(file.path), lines, status, added, removed };
}

/** Sort: changed first, then new, then unchanged; alpha within each bucket. */
function sortCards(cards: FileCardInfo[]): FileCardInfo[] {
  const rank = (s: CardStatus) => (s === "changed" ? 0 : s === "new" ? 1 : 2);
  return [...cards].sort((a, b) => rank(a.status) - rank(b.status) || a.path.localeCompare(b.path));
}

function Badge({ card }: { card: FileCardInfo }) {
  const lang = useLang();
  if (card.status === "new") {
    return (
      <span data-testid="badge-neu" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, background: "var(--success-soft, #E1EDDE)", color: "var(--success, #3D7A4F)", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 600, fontFamily: "var(--font-sans)" }}>
        {t(lang, "NEU", "NEW")}
      </span>
    );
  }
  if (card.status === "changed") {
    return (
      <span data-testid="badge-geaendert" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, background: "var(--warning-soft, #F7E8C2)", color: "var(--warning, #C7901A)", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 600, fontFamily: "var(--font-sans)" }}>
        {t(lang, "GEÄNDERT", "CHANGED")}
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 500 }}>+{card.added} −{card.removed}</span>
      </span>
    );
  }
  return null;
}

interface Props {
  files: SessionFile[];
  baseFiles: Record<string, string>;
  /** P1.7: paths whose saved base could not be fetched — never shown as NEU. */
  unknownBase?: ReadonlySet<string>;
  onOpenReader: (path: string) => void;
  onOpenDiff: (path: string) => void;
}

export function FileCardList({ files, baseFiles, unknownBase, onOpenReader, onOpenDiff }: Props) {
  const lang = useLang();
  const [filter, setFilter] = useState("");

  const cards = useMemo(() => sortCards(files.map((f) => classifyCard(f, baseFiles, unknownBase))), [files, baseFiles, unknownBase]);
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? cards.filter((c) => c.path.toLowerCase().includes(q)) : cards;
  }, [cards, filter]);

  return (
    <div data-testid="file-card-list" style={{ flex: 1, minHeight: 0, overflow: "auto", background: "var(--ed-canvas)", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--ed-canvas)", padding: "10px 12px 8px", borderBottom: "1px solid var(--ed-rule)" }}>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t(lang, "Dateien filtern…", "Filter files…")}
          aria-label={t(lang, "Dateien filtern", "Filter files")}
          data-testid="file-card-filter"
          style={{ width: "100%", background: "var(--ed-chrome)", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-1)", borderRadius: 8, padding: "9px 11px", fontSize: 16, fontFamily: "var(--font-sans)", outline: "none" }}
        />
      </div>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.length === 0 ? (
          <div style={{ color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)", fontSize: 14, padding: "24px 8px", textAlign: "center" }}>
            {files.length === 0 ? t(lang, "Noch keine Dateien.", "No files yet.") : t(lang, "Keine Treffer.", "No matches.")}
          </div>
        ) : shown.map((card) => (
          <button
            key={card.path}
            data-testid="file-card"
            data-status={card.status}
            onClick={() => (card.status === "changed" ? onOpenDiff(card.path) : onOpenReader(card.path))}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
              background: "var(--ed-chrome)", border: "1px solid var(--ed-rule)", borderRadius: 12,
              padding: "12px 14px", cursor: "pointer", minHeight: 44,
            }}
          >
            <Icon name="code" size={16} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", color: "var(--ed-fg-1)", fontFamily: "JetBrains Mono, monospace", fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {card.path}
              </span>
              <span style={{ display: "block", color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)", fontSize: 11.5, marginTop: 2 }}>
                {card.lang} · {card.lines} {t(lang, "Zeilen", "lines")}
              </span>
            </span>
            <Badge card={card} />
            <Icon name="forward" size={14} />
          </button>
        ))}
      </div>
    </div>
  );
}
