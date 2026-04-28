'use client';
import { useEffect, useRef, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';

// Goblin dark theme (basierend auf #141a12 BG + Ochre Akzente)
const goblinTheme = EditorView.theme({
  '&': { background: '#141a12', color: '#8aaa85', height: '100%', fontSize: '13px' },
  '.cm-content': { fontFamily: 'JetBrains Mono, monospace', padding: '12px 0' },
  '.cm-line': { padding: '0 14px' },
  '.cm-gutters': { background: '#0f1410', border: 'none', color: '#1e3a1c' },
  '.cm-activeLineGutter': { background: 'rgba(201,147,58,0.05)' },
  '.cm-activeLine': { background: 'rgba(201,147,58,0.04)' },
  '.cm-cursor': { borderLeft: '2px solid #c9933a' },
  '.cm-selectionBackground': { background: 'rgba(201,147,58,0.15) !important' },
  '.cm-tooltip': { background: '#1e2a1c', border: '1px solid #2d4a2b' },
  '.cm-completionLabel': { color: '#8aaa85' },
  '.cm-completionMatchedText': { color: '#c9933a', textDecoration: 'none', fontWeight: 600 },
}, { dark: true });

function getLanguage(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js': case 'jsx': case 'ts': case 'tsx': return javascript({ jsx: true, typescript: true });
    case 'css': case 'scss': case 'less': return css();
    case 'html': case 'htm': case 'svelte': case 'vue': return html();
    case 'json': return json();
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
    const content = view.state.doc.toString();
    onSave?.(content);
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
          { key: 'Mod-s', run: (view) => { handleSave(view); return true; } },
        ]),
        EditorView.updateListener.of(update => {
          if (update.docChanged) onChange?.(update.state.doc.toString());
        }),
        EditorState.readOnly.of(readOnly),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => { view.destroy(); viewRef.current = null; };
  }, [filename]); // Re-init only when filename changes

  // Update content when prop changes (e.g. from injection)
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
    <div
      ref={containerRef}
      style={{ height: '100%', overflow: 'auto', minHeight: 0 }}
    />
  );
}