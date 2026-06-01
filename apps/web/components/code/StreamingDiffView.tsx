"use client";

import { useEffect, useRef } from "react";
import { EditorState, StateField, type Extension } from "@codemirror/state";
import { EditorView, Decoration, lineNumbers, type DecorationSet } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { diffLines } from "diff";

// Diff line decorations — proposed v1.2 tokens (CODETAB_PROPOSED_TOKENS):
//   --syn-added-light  : #E1EDDE bg + green left border
//   --syn-removed-light: muted-red strikethrough
const diffTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px" },
  ".cm-content": { fontFamily: "JetBrains Mono, monospace" },
  ".gb-diff-add": { backgroundColor: "#E1EDDE", borderLeft: "3px solid #2F6A47" },
  ".gb-diff-del": { backgroundColor: "rgba(176,67,42,0.09)", textDecoration: "line-through", color: "#9a5a4a" },
});

function langFor(filename: string): Extension {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "css" || ext === "scss" || ext === "less") return css();
  if (ext === "html" || ext === "htm" || ext === "vue" || ext === "svelte") return html();
  if (ext === "json") return json();
  return javascript({ jsx: true, typescript: true });
}

/** Build the unified-diff document + the added/removed line decorations. */
function buildDiff(original: string, modified: string): { doc: string; decoFor: (state: EditorState) => DecorationSet } {
  let doc = "";
  const added: number[] = [];
  const removed: number[] = [];
  let lineNo = 0;
  try {
    for (const part of diffLines(original, modified)) {
      const lines = part.value.split("\n");
      if (lines.length && lines[lines.length - 1] === "") lines.pop();
      for (const ln of lines) {
        doc += ln + "\n";
        lineNo++;
        if (part.added) added.push(lineNo);
        else if (part.removed) removed.push(lineNo);
      }
    }
  } catch {
    // Malformed → fall back to plain modified content, no decorations.
    return { doc: modified, decoFor: () => Decoration.none };
  }
  if (!doc) doc = modified;

  const addDeco = Decoration.line({ attributes: { class: "gb-diff-add" } });
  const delDeco = Decoration.line({ attributes: { class: "gb-diff-del" } });
  const decoFor = (state: EditorState): DecorationSet => {
    const ranges = [];
    const total = state.doc.lines;
    for (const n of removed) if (n <= total) ranges.push({ at: state.doc.line(n).from, deco: delDeco });
    for (const n of added) if (n <= total) ranges.push({ at: state.doc.line(n).from, deco: addDeco });
    ranges.sort((a, b) => a.at - b.at);
    return Decoration.set(ranges.map((r) => r.deco.range(r.at)));
  };
  return { doc, decoFor };
}

interface Props { original: string; modified: string; filename: string; }

/** Read-only unified diff of original→modified, used as the live overlay while
 *  the AI edits an EXISTING file. Rebuilds on every `modified` change (stream). */
export function StreamingDiffView({ original, modified, filename }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const { doc, decoFor } = buildDiff(original, modified);
    const field = StateField.define<DecorationSet>({
      create: (state) => decoFor(state),
      update: (deco) => deco,
      provide: (f) => EditorView.decorations.from(f),
    });
    const view = new EditorView({
      parent: ref.current,
      state: EditorState.create({
        doc,
        extensions: [lineNumbers(), langFor(filename), diffTheme, EditorState.readOnly.of(true), EditorView.lineWrapping, field],
      }),
    });
    return () => view.destroy();
  }, [original, modified, filename]);

  return <div ref={ref} style={{ height: "100%", overflow: "auto" }} />;
}
