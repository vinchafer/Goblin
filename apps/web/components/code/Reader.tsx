"use client";

// MOBILE-1 · M2 — Tier 1 Reader (spec §3).
//
// Read-only, syntax-highlighted, line-numbered. NO keyboard grab (the view is
// never focused, editing is disabled), NO find/replace chrome — search is a
// simple filter field that highlights matches in place. Horizontal pan (no line
// wrapping) with a subtle gradient hint at the right edge. Sticky mini-header:
// filename + close, plus the explicit "Bearbeiten" door to Tier 3 (M5).
//
// Reuses the editor-surface palette + highlighter (exported from code-editor) so
// the Reader reads identically to the editor without pulling in its edit keymap,
// history, or find panel.

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorState, StateEffect, StateField, RangeSetBuilder } from "@codemirror/state";
import { EditorView, Decoration, lineNumbers } from "@codemirror/view";
import { bracketMatching } from "@codemirror/language";
import { LIGHT, DARK, buildViewTheme, buildHighlight, getLanguage } from "@/components/editor/code-editor";
import { Icon } from "@/components/ui/icon";
import { useLang, t } from "@/lib/use-lang";
import type { EditorTheme } from "@/hooks/code/useEditorTheme";

// ── Filter highlight: mark every match of the filter query, no search panel. ──
const setFilter = StateEffect.define<string>();
const matchMark = Decoration.mark({ class: "gb-reader-match" });

function computeMatches(state: EditorState, query: string) {
  const b = new RangeSetBuilder<Decoration>();
  const q = query.trim();
  if (q) {
    const lower = state.doc.toString().toLowerCase();
    const needle = q.toLowerCase();
    let i = lower.indexOf(needle);
    while (i !== -1) {
      b.add(i, i + q.length, matchMark);
      i = lower.indexOf(needle, i + Math.max(1, q.length));
    }
  }
  return b.finish();
}

const filterField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) if (e.is(setFilter)) return computeMatches(tr.state, e.value);
    return tr.docChanged ? deco.map(tr.changes) : deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

function firstMatchPos(doc: string, query: string): number | null {
  const q = query.trim();
  if (!q) return null;
  const i = doc.toLowerCase().indexOf(q.toLowerCase());
  return i === -1 ? null : i;
}

interface Props {
  path: string;
  content: string;
  theme: EditorTheme;
  onClose: () => void;
  onEdit?: () => void;
  /** M3: long-press a line (or long-press with a selection) → Tier-2 action sheet. */
  onLineAction?: (from: number, to: number) => void;
}

export function Reader({ path, content, theme, onClose, onEdit, onLineAction }: Props) {
  const lang = useLang();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [filter, setFilter_] = useState("");
  // M3: long-press detection. Hold ~500ms without moving → resolve the line under
  // the pointer (or the current selection's line range) and open the action sheet.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressPos = useRef<{ x: number; y: number } | null>(null);
  const clearPress = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };

  const palette = theme === "dark" ? DARK : LIGHT;

  useEffect(() => {
    if (!containerRef.current) return;
    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        bracketMatching(),
        getLanguage(path),
        buildViewTheme(palette, theme === "dark"),
        buildHighlight(palette),
        filterField,
        EditorView.editable.of(false),      // no edit
        EditorState.readOnly.of(true),
        EditorView.theme({
          ".gb-reader-match": { background: "rgba(212,167,55,0.34)", borderRadius: "2px" },
        }),
        // Deliberately NO lineWrapping → horizontal pan; NO search/edit keymap.
      ],
    });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    // Never focus — opening the Reader must not raise the keyboard.
    return () => { view.destroy(); viewRef.current = null; };
  }, [path, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep content in sync if the same path's content changes underneath.
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    const cur = v.state.doc.toString();
    if (cur !== content) v.dispatch({ changes: { from: 0, to: cur.length, insert: content } });
  }, [content]);

  const applyFilter = (q: string) => {
    setFilter_(q);
    const v = viewRef.current;
    if (!v) return;
    const pos = firstMatchPos(v.state.doc.toString(), q);
    v.dispatch({
      effects: [setFilter.of(q), ...(pos != null ? [EditorView.scrollIntoView(pos, { y: "center" })] : [])],
    });
  };

  const lineTotal = useMemo(() => content.split("\n").length, [content]);

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--ed-canvas)", display: "flex", flexDirection: "column", minHeight: 0, zIndex: 5 }}>
      {/* Sticky mini-header: filename + filter + close/edit */}
      <div style={{ flexShrink: 0, borderBottom: "1px solid var(--ed-rule)", background: "var(--ed-chrome)", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onClose} aria-label={t(lang, "Zurück", "Back")} data-testid="reader-close"
            style={{ background: "transparent", border: "none", color: "var(--ed-fg-2)", cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 4 }}>
            <Icon name="back" size={18} />
          </button>
          <span style={{ flex: 1, minWidth: 0, color: "var(--ed-fg-1)", fontFamily: "JetBrains Mono, monospace", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {path}
          </span>
          <span style={{ flexShrink: 0, color: "var(--ed-fg-3)", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
            {lineTotal} {t(lang, "Zeilen", "lines")}
          </span>
          {onEdit && (
            <button onClick={onEdit} data-testid="reader-edit"
              style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 8, padding: "5px 9px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
              <Icon name="rename" size={13} /> {t(lang, "Bearbeiten", "Edit")}
            </button>
          )}
        </div>
        <input
          value={filter}
          onChange={(e) => applyFilter(e.target.value)}
          placeholder={t(lang, "Im Text filtern…", "Filter in file…")}
          aria-label={t(lang, "Im Text filtern", "Filter in file")}
          data-testid="reader-filter"
          style={{ width: "100%", background: "var(--ed-canvas)", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-1)", borderRadius: 8, padding: "8px 10px", fontSize: 16, fontFamily: "var(--font-sans)", outline: "none" }}
        />
      </div>

      {/* Code viewport — horizontal pan with a gradient hint at the right edge. */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div
          ref={containerRef}
          data-testid="reader-code"
          style={{ height: "100%", overflow: "auto" }}
          onPointerDown={(e) => {
            if (!onLineAction) return;
            pressPos.current = { x: e.clientX, y: e.clientY };
            clearPress();
            pressTimer.current = setTimeout(() => {
              const v = viewRef.current;
              const pos = pressPos.current;
              if (!v || !pos) return;
              const sel = v.state.selection.main;
              let from: number, to: number;
              if (!sel.empty) {
                from = v.state.doc.lineAt(sel.from).number;
                to = v.state.doc.lineAt(sel.to).number;
              } else {
                const p = v.posAtCoords({ x: pos.x, y: pos.y });
                if (p == null) return;
                from = to = v.state.doc.lineAt(p).number;
              }
              onLineAction(from, to);
            }, 500);
          }}
          onPointerMove={(e) => {
            const p = pressPos.current;
            if (p && (Math.abs(e.clientX - p.x) > 8 || Math.abs(e.clientY - p.y) > 8)) clearPress();
          }}
          onPointerUp={clearPress}
          onPointerCancel={clearPress}
        />
        <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 18, pointerEvents: "none", background: "linear-gradient(to right, transparent, var(--ed-canvas))" }} />
      </div>
    </div>
  );
}
