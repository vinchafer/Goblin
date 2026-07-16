"use client";

// MOBILE-1 · M3 — Tier 2 "Point & instruct" action sheet (spec §3, Tier 2).
//
// Long-press a line (or drag a range) in the Reader or Diff sheet → this bottom
// sheet: exactly two actions, no menu-bloat. "Diese Stelle ändern lassen" pre-
// anchors the command bar; "Kopieren" copies the selected line(s). Nothing more.

import { Icon } from "@/components/ui/icon";
import { useLang, t } from "@/lib/use-lang";

interface Props {
  file: string;
  from: number;
  to: number;
  onChange: () => void;
  onCopy: () => void;
  onClose: () => void;
}

export function LineActionSheet({ file, from, to, onChange, onCopy, onClose }: Props) {
  const lang = useLang();
  const range = from === to ? `${t(lang, "Zeile", "Line")} ${from}` : `${t(lang, "Zeile", "Line")} ${from}–${to}`;
  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 70, background: "var(--surface-overlay, rgba(0,0,0,0.4))" }} />
      <div
        role="dialog" aria-label={t(lang, "Aktion für Auswahl", "Action for selection")} data-testid="line-action-sheet"
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 71,
          background: "var(--ed-canvas)", borderTop: "1px solid var(--ed-rule)",
          // SAFEAREA-U-BOTTOM: bottom-sheet — extend the bottom pad by the iOS
          // home-indicator inset so the last action clears it (0 in a browser).
          borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: "10px 12px calc(16px + env(safe-area-inset-bottom, 0px))",
          boxShadow: "0 -12px 40px rgba(15,43,30,0.28)", display: "flex", flexDirection: "column", gap: 6,
        }}
      >
        <div style={{ padding: "6px 8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="code" size={14} />
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12.5, color: "var(--ed-fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {file} · {range}
          </span>
        </div>
        <button
          onClick={onChange} data-testid="line-action-change"
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "var(--ed-primary)", color: "var(--ed-on-primary)", border: "none", borderRadius: 10, padding: "13px 14px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", minHeight: 44 }}
        >
          <Icon name="mic" size={16} /> {t(lang, "Diese Stelle ändern lassen", "Change this part")}
        </button>
        <button
          onClick={onCopy} data-testid="line-action-copy"
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "transparent", color: "var(--ed-fg-1)", border: "1px solid var(--ed-rule)", borderRadius: 10, padding: "13px 14px", fontSize: 15, cursor: "pointer", fontFamily: "var(--font-sans)", minHeight: 44 }}
        >
          <Icon name="copy" size={16} /> {t(lang, "Kopieren", "Copy")}
        </button>
      </div>
    </>
  );
}
