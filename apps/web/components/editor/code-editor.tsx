'use client';
import { useEffect, useRef, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import {
  defaultKeymap, history, historyKeymap,
  indentWithTab,
  moveLineUp, moveLineDown, copyLineDown,
} from '@codemirror/commands';

// Editor theme constants — resolved from design-tokens.css (v1.1). CodeMirror's
// EditorView.theme is kept on resolved values for predictable syntax rendering;
// if these tokens change, update both here and design-tokens.css. The editor is
// the one sanctioned dark surface in the light app (§A2.4 founder decision).
const EDITOR_BG        = '#28251D';                // --surface-ink-2 (editor surface)
const EDITOR_BG_DEEP   = '#08170F';                // --green-950 (gutters, panels)
const EDITOR_FG        = '#FBF7EC';                // --ink-on-dark-1
const EDITOR_FG_MUTED  = '#D8CBA8';                // --ink-on-dark-2
const EDITOR_FG_FAINT  = '#968768';                // --ink-on-dark-3
const EDITOR_ACCENT    = '#D4A737';                // --brand-gold
const EDITOR_SELECTION = 'rgba(212,167,55,0.18)';  // gold @ 18%
const EDITOR_LINE      = 'rgba(212,167,55,0.05)';  // active line/gutter tint
const EDITOR_BORDER    = 'rgba(247,247,236,0.14)'; // --rule-strong on dark

const goblinTheme = EditorView.theme({
  '&': { background: EDITOR_BG, color: EDITOR_FG, height: '100%', fontSize: '13px' },
  '.cm-content': { fontFamily: 'JetBrains Mono, monospace', padding: '12px 0', caretColor: EDITOR_ACCENT },
  '.cm-line': { padding: '0 14px' },
  '.cm-gutters': { background: EDITOR_BG_DEEP, border: 'none', color: EDITOR_FG_FAINT },
  '.cm-lineNumbers .cm-gutterElement': { minWidth: '32px', padding: '0 8px 0 4px' },
  '.cm-activeLineGutter': { background: EDITOR_LINE, color: EDITOR_FG_MUTED },
  '.cm-activeLine': { background: EDITOR_LINE },
  '.cm-cursor': { borderLeft: `2px solid ${EDITOR_ACCENT}` },
  '.cm-selectionBackground': { background: `${EDITOR_SELECTION} !important` },
  '.cm-tooltip': { background: EDITOR_BG_DEEP, border: `1px solid ${EDITOR_BORDER}` },
  '.cm-completionLabel': { color: EDITOR_FG_MUTED },
  '.cm-completionMatchedText': { color: EDITOR_ACCENT, textDecoration: 'none', fontWeight: 600 },
  '.cm-matchingBracket': { background: EDITOR_SELECTION, outline: `1px solid ${EDITOR_ACCENT}` },
  '.cm-tooltip-autocomplete': { background: EDITOR_BG_DEEP, border: `1px solid ${EDITOR_BORDER}` },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { background: EDITOR_SELECTION },
}, { dark: true });

function getLanguage(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js': case 'jsx': case 'ts': case 'tsx': case 'mjs': case 'cjs':
      return javascript({ jsx: true, typescript: true });
    case 'css': case 'scss': case 'less': return css();
    case 'html': case 'htm': case 'svelte': case 'vue': return html();
    case 'json': case 'jsonc': return json();
    default: return javascript({ jsx: true, typescript: true });
  }
}

interface CodeEditorProps {
  content: string;
  filename: string;
  onChange?: (content: string) => void;
  onSave?: (content: string) => void;
  onEditorReady?: (view: EditorView) => void;
  readOnly?: boolean;
}

export function CodeEditor({ content, filename, onChange, onSave, onEditorReady, readOnly = false }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const handleSave = useCallback((view: EditorView) => {
    onSave?.(view.state.doc.toString());
    return true;
  }, [onSave]);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        getLanguage(filename),
        goblinTheme,
        history(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
          { key: 'Mod-s',       run: (view: EditorView) => { handleSave(view); return true; } },
          { key: 'Alt-ArrowUp',   run: moveLineUp },
          { key: 'Alt-ArrowDown', run: moveLineDown },
          { key: 'Mod-d',        run: copyLineDown },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange?.(update.state.doc.toString());
        }),
        EditorState.readOnly.of(readOnly),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    onEditorReady?.(view);

    return () => { view.destroy(); viewRef.current = null; };
  }, [filename]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update content from outside (injection)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== content) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: content }
      });
    }
  }, [content]);

  return (
    <div ref={containerRef} style={{ height: '100%', overflow: 'auto', minHeight: 0 }} />
  );
}
