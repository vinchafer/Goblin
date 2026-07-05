"use client";

// MOBILE-1 · M5 — compact find/replace overlay (spec §3, Tier 3).
//
// Fixes one of the two mobile editor sins: the find/replace bar was the
// permanent desktop CodeMirror panel (openSearchPanel), which eats vertical
// space and reads as chrome. This is a compact floating overlay instead — a
// single row (find + prev/next + count), with replace revealed on demand. It
// drives CodeMirror's own search commands via @codemirror/search, so behaviour
// (match highlighting, wrap-around) is identical; only the surface is compact.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { EditorView } from "@codemirror/view";
import {
  SearchQuery, setSearchQuery, findNext, findPrevious, replaceNext, replaceAll, closeSearchPanel,
} from "@codemirror/search";
import { Icon } from "@/components/ui/icon";
import { useLang, t } from "@/lib/use-lang";

interface Props {
  view: EditorView;
  onClose: () => void;
}

export function EditorSearchOverlay({ view, onClose }: Props) {
  const lang = useLang();
  const [query, setQuery] = useState("");
  const [replace, setReplace] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Push the query into CodeMirror's search state (highlights all matches). We
  // never open the built-in panel — closeSearchPanel keeps it hidden if a
  // keybinding opened it.
  useEffect(() => {
    view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: query, replace })) });
  }, [query, replace, view]);

  useEffect(() => {
    // Focus the overlay input (user explicitly opened search) — NOT the editor,
    // so this never fights the "no keyboard grab on editor open" rule.
    inputRef.current?.focus();
    return () => { closeSearchPanel(view); };
  }, [view]);

  const next = () => { findNext(view); };
  const prev = () => { findPrevious(view); };

  return (
    <div
      data-testid="editor-search-overlay"
      style={{
        position: "absolute", top: 8, left: 8, right: 8, zIndex: 20,
        background: "var(--ed-chrome-2, var(--ed-canvas))", border: "1px solid var(--ed-rule)",
        borderRadius: 10, boxShadow: "0 8px 24px rgba(15,43,30,0.22)", padding: 8,
        display: "flex", flexDirection: "column", gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name="search" size={15} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.shiftKey ? prev() : next(); } if (e.key === "Escape") onClose(); }}
          placeholder={t(lang, "Suchen…", "Find…")}
          aria-label={t(lang, "Im Code suchen", "Find in code")}
          data-testid="editor-search-input"
          style={{ flex: 1, minWidth: 0, background: "var(--ed-canvas)", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-1)", borderRadius: 8, padding: "7px 9px", fontSize: 16, fontFamily: "var(--font-sans)", outline: "none" }}
        />
        <button onClick={prev} aria-label={t(lang, "Vorheriger", "Previous")} style={btn}><Icon name="collapse" size={15} /></button>
        <button onClick={next} aria-label={t(lang, "Nächster", "Next")} style={btn}><Icon name="expand" size={15} /></button>
        <button onClick={() => setShowReplace(v => !v)} aria-label={t(lang, "Ersetzen", "Replace")} title={t(lang, "Ersetzen", "Replace")} data-testid="editor-search-toggle-replace" style={btn}><Icon name="rename" size={14} /></button>
        <button onClick={onClose} aria-label={t(lang, "Schließen", "Close")} data-testid="editor-search-close" style={btn}><Icon name="close" size={15} /></button>
      </div>
      {showReplace && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            placeholder={t(lang, "Ersetzen durch…", "Replace with…")}
            aria-label={t(lang, "Ersetzen durch", "Replace with")}
            style={{ flex: 1, minWidth: 0, background: "var(--ed-canvas)", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-1)", borderRadius: 8, padding: "7px 9px", fontSize: 16, fontFamily: "var(--font-sans)", outline: "none" }}
          />
          <button onClick={() => replaceNext(view)} style={{ ...btn, width: "auto", padding: "0 10px", fontSize: 12.5, fontFamily: "var(--font-sans)" }}>{t(lang, "Ersetzen", "Replace")}</button>
          <button onClick={() => replaceAll(view)} style={{ ...btn, width: "auto", padding: "0 10px", fontSize: 12.5, fontFamily: "var(--font-sans)" }}>{t(lang, "Alle", "All")}</button>
        </div>
      )}
    </div>
  );
}

const btn: CSSProperties = {
  flexShrink: 0, width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 8, cursor: "pointer",
};
