"use client";

// MOBILE-1 · M2 — the Diff sheet (spec §4). Bottom sheet on mobile.
//
// The default way a GEÄNDERT change is consumed: tapping a changed file card
// opens this first (review-before-anything). Per-hunk unified diff with a file
// header `path · +n −m`. M2 ships the base actions (whole-file → Reader,
// dismiss); M3 adds "Diese Stelle ändern lassen" (re-anchor to a hunk) and M4
// elevates it with the "Live stellen" flow — all via the optional callbacks so
// this component is extended, never rewritten.

import { useMemo } from "react";
import { Icon } from "@/components/ui/icon";
import { unifiedDiffLines } from "@/lib/file-compare";
import { useLang, t } from "@/lib/use-lang";

interface Props {
  path: string;
  base: string;
  proposed: string;
  added: number;
  removed: number;
  onClose: () => void;
  /** "Ganze Datei ansehen" → Reader. */
  onWholeFile: () => void;
  /** M3: "Diese Stelle ändern lassen" — pre-anchor the command bar to a hunk. */
  onReanchor?: (range: { from: number; to: number }) => void;
}

export function DiffSheet({ path, base, proposed, added, removed, onClose, onWholeFile, onReanchor }: Props) {
  const lang = useLang();
  const lines = useMemo(() => unifiedDiffLines(path, base, proposed), [path, base, proposed]);

  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 60, background: "var(--surface-overlay, rgba(0,0,0,0.4))" }} />
      <div
        role="dialog" aria-label={t(lang, "Änderungen ansehen", "Review changes")} data-testid="diff-sheet"
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 61, maxHeight: "82%",
          background: "var(--ed-canvas)", borderTop: "1px solid var(--ed-rule)",
          borderTopLeftRadius: 16, borderTopRightRadius: 16, display: "flex", flexDirection: "column",
          boxShadow: "0 -12px 40px rgba(15,43,30,0.28)",
        }}
      >
        {/* Header: path · +n −m */}
        <div style={{ flexShrink: 0, padding: "12px 14px", borderBottom: "1px solid var(--ed-rule)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--ed-fg-1)", fontFamily: "JetBrains Mono, monospace", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{path}</span>
            <span style={{ flexShrink: 0, fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "var(--ed-fg-3)" }}>
              <span style={{ color: "var(--success, #3D7A4F)" }}>+{added}</span>{" "}
              <span style={{ color: "var(--danger, #B0432A)" }}>−{removed}</span>
            </span>
          </span>
          <button onClick={onClose} aria-label={t(lang, "Schließen", "Close")} data-testid="diff-sheet-close"
            style={{ background: "transparent", border: "none", color: "var(--ed-fg-3)", cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 4 }}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Unified diff */}
        <div data-testid="diff-sheet-body" style={{ flex: 1, minHeight: 0, overflow: "auto", fontFamily: "JetBrains Mono, monospace", fontSize: 12.5, lineHeight: 1.55, padding: "8px 0" }}>
          {lines.map((l, i) => {
            const bg = l.kind === "add" ? "rgba(61,122,79,0.12)" : l.kind === "del" ? "rgba(176,67,42,0.10)" : l.kind === "hunk" ? "var(--ed-chrome)" : "transparent";
            const color = l.kind === "add" ? "var(--success, #3D7A4F)" : l.kind === "del" ? "var(--danger, #B0432A)" : l.kind === "hunk" ? "var(--ed-fg-3)" : "var(--ed-fg-2)";
            const prefix = l.kind === "add" ? "+" : l.kind === "del" ? "−" : l.kind === "hunk" ? "" : " ";
            return (
              <div key={i} style={{ background: bg, color, padding: "0 14px", whiteSpace: "pre", overflowX: "auto" }}>
                {prefix}{l.text}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ flexShrink: 0, borderTop: "1px solid var(--ed-rule)", background: "var(--ed-chrome)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          {onReanchor && (
            <button onClick={() => onReanchor({ from: 1, to: proposed.split("\n").length })} data-testid="diff-sheet-reanchor"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 9, padding: "9px 12px", fontSize: 13, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
              <Icon name="code" size={13} /> {t(lang, "Diese Stelle ändern lassen", "Change this part")}
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button onClick={onWholeFile} data-testid="diff-sheet-wholefile"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
            {t(lang, "Ganze Datei", "Whole file")}
          </button>
        </div>
      </div>
    </>
  );
}
