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

const goblinTheme = EditorView.theme({
  '&': { background: '#141a12', color: '#8aaa85', height: '100%', fontSize: '13px' },
  '.cm-content': { fontFamily: 'JetBrains Mono, monospace', padding: '12px 0' },
  '.cm-line': { padding: '0 14px' },
  '.cm-gutters': { background: '#0f1410', border: 'none', color: '#4a6a4a' },
  '.cm-lineNumbers .cm-gutterElement': { minWidth: '32px', padding: '0 8px 0 4px' },
  '.cm-activeLineGutter': { background: 'rgba(201,147,58,0.06)' },
  '.cm-activeLine': { background: 'rgba(201,147,58,0.04)' },
  '.cm-cursor': { borderLeft: '2px solid #c9933a' },
  '.cm-selectionBackground': { background: 'rgba(201,147,58,0.15) !important' },
  '.cm-tooltip': { background: '#1e2a1c', border: '1px solid #2d4a2b' },
  '.cm-completionLabel': { color: '#8aaa85' },
  '.cm-completionMatchedText': { color: 'var(--ochre-dark)', textDecoration: 'none', fontWeight: 600 },
  '.cm-matchingBracket': { background: 'rgba(201,147,58,0.2)', outline: '1px solid rgba(201,147,58,0.4)' },
  '.cm-tooltip-autocomplete': { background: '#1e2a1c', border: '1px solid #2d4a2b' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { background: 'rgba(201,147,58,0.15)' },
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
  readOnly?: boolean;
}

export function CodeEditor({ content, filename, onChange, onSave, readOnly = false }: CodeEditorProps) {
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
