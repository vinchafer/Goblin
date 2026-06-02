'use client';
import { useEffect, useRef, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import {
  defaultKeymap, history, historyKeymap,
  indentWithTab,
  moveLineUp, moveLineDown, copyLineDown,
} from '@codemirror/commands';
import { search, searchKeymap } from '@codemirror/search';

// ── Goblin editor themes — resolved from design-tokens.css v1.1 + the PROPOSED
// Code-Tab token set (CODETAB_PROPOSED_TOKENS_2026-06-01.md). Light is the new
// default surface (Sprint 6): a calm paper canvas the founder can actually read.
// Dark is a retuned WARM-dark (surface-ink-1 #3F3A2C), NOT the old #28251D/#08170F
// "black hole". Theme is chosen by the `theme` prop, persisted per user.
type EditorTheme = 'light' | 'dark';

interface Palette {
  canvas: string; chrome: string; fg: string; fgMuted: string; fgFaint: string;
  gutterFg: string; accent: string; selection: string; activeLine: string; border: string;
  syn: {
    keyword: string; string: string; number: string; comment: string;
    func: string; variable: string; punct: string; tag: string; type: string; invalid: string;
  };
}

const LIGHT: Palette = {
  canvas: '#FBF7EC',          // --surface-1 (paper)
  chrome: '#F4ECD8',          // --surface-2 (bone) — gutters/panels
  fg: '#0F2B1E',              // --ink-deep
  fgMuted: '#3F3A2C',         // --ink-2
  fgFaint: '#5F5640',         // --ink-3
  gutterFg: '#A99B78',
  accent: '#D4A737',          // --brand-gold
  selection: 'rgba(212,167,55,0.20)',
  activeLine: 'rgba(26,58,42,0.04)',
  border: '#D8CBA8',          // --rule
  syn: {
    keyword: '#2A523E', string: '#9A6B1E', number: '#355B7A', comment: '#8A8268',
    func: '#355B7A', variable: '#0F2B1E', punct: '#5F5640', tag: '#5E4514',
    type: '#2A523E', invalid: '#B0432A',
  },
};

const DARK: Palette = {
  canvas: '#3F3A2C',          // --surface-ink-1 (warm-dark, retuned)
  chrome: '#28251D',          // --surface-ink-2 (gutters/panels)
  fg: '#FBF7EC',              // --ink-on-dark-1
  fgMuted: '#D8CBA8',         // --ink-on-dark-2
  fgFaint: '#968768',         // --ink-on-dark-3
  gutterFg: '#6F664F',
  accent: '#D4A737',
  selection: 'rgba(212,167,55,0.18)',
  activeLine: 'rgba(212,167,55,0.06)',
  border: 'rgba(247,247,236,0.14)',
  syn: {
    keyword: '#87A998', string: '#E8C97F', number: '#B5CCC0', comment: '#968768',
    func: '#B5CCC0', variable: '#FBF7EC', punct: '#D8CBA8', tag: '#C9B27E',
    type: '#87A998', invalid: '#E0866F',
  },
};

function buildViewTheme(p: Palette, dark: boolean) {
  return EditorView.theme({
    '&': { background: p.canvas, color: p.fg, height: '100%', fontSize: '13px' },
    '.cm-content': { fontFamily: 'JetBrains Mono, monospace', padding: '14px 0', caretColor: p.accent },
    '.cm-line': { padding: '0 18px' },
    '.cm-gutters': { background: p.chrome, border: 'none', borderRight: `1px solid ${p.border}`, color: p.gutterFg },
    '.cm-lineNumbers .cm-gutterElement': { minWidth: '32px', padding: '0 8px 0 12px' },
    '.cm-activeLineGutter': { background: p.activeLine, color: p.fgMuted },
    '.cm-activeLine': { background: p.activeLine },
    '.cm-cursor': { borderLeft: `2px solid ${p.accent}` },
    '.cm-selectionBackground, ::selection': { background: `${p.selection} !important` },
    '.cm-tooltip': { background: p.chrome, border: `1px solid ${p.border}`, color: p.fg },
    '.cm-completionLabel': { color: p.fgMuted },
    '.cm-completionMatchedText': { color: p.accent, textDecoration: 'none', fontWeight: '600' },
    '.cm-matchingBracket': { background: p.selection, outline: `1px solid ${p.accent}` },
    '.cm-tooltip-autocomplete': { background: p.chrome, border: `1px solid ${p.border}` },
    '.cm-tooltip-autocomplete ul li[aria-selected]': { background: p.selection },
  }, { dark });
}

function buildHighlight(p: Palette) {
  const s = p.syn;
  return syntaxHighlighting(HighlightStyle.define([
    { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], color: s.keyword, fontWeight: '500' },
    { tag: [t.string, t.special(t.string), t.regexp], color: s.string },
    { tag: [t.number, t.bool, t.null, t.atom], color: s.number },
    { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: s.comment, fontStyle: 'italic' },
    { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], color: s.func },
    { tag: [t.variableName, t.propertyName, t.attributeValue], color: s.variable },
    { tag: [t.punctuation, t.separator, t.operator, t.derefOperator, t.bracket, t.squareBracket, t.brace, t.paren], color: s.punct },
    { tag: [t.tagName, t.angleBracket, t.attributeName], color: s.tag },
    { tag: [t.typeName, t.className, t.namespace], color: s.type },
    { tag: t.invalid, color: s.invalid },
    { tag: [t.heading, t.strong], color: s.keyword, fontWeight: '600' },
    { tag: [t.link, t.url], color: s.func, textDecoration: 'underline' },
  ]));
}

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
  /** Editor surface theme. Light is the Sprint-6 default. */
  theme?: EditorTheme;
}

export function CodeEditor({ content, filename, onChange, onSave, onEditorReady, readOnly = false, theme = 'light' }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const handleSave = useCallback((view: EditorView) => {
    onSave?.(view.state.doc.toString());
    return true;
  }, [onSave]);

  useEffect(() => {
    if (!containerRef.current) return;

    const palette = theme === 'dark' ? DARK : LIGHT;

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        getLanguage(filename),
        buildViewTheme(palette, theme === 'dark'),
        buildHighlight(palette),
        history(),
        // Find/Replace panel at top (Slice 5). basicSetup bundles searchKeymap, but
        // we add it explicitly + position the panel so it never hides behind the
        // status bar. Ctrl+F find, Ctrl+H replace.
        search({ top: true }),
        keymap.of([
          ...searchKeymap,   // Ctrl+F/Ctrl+H + Ctrl+D = select next occurrence (multi-cursor)
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
          { key: 'Mod-s',       run: (view: EditorView) => { handleSave(view); return true; } },
          { key: 'Alt-ArrowUp',   run: moveLineUp },
          { key: 'Alt-ArrowDown', run: moveLineDown },
          // copyLineDown moved off Ctrl+D (which now does multi-cursor select-next,
          // matching VS Code) to Shift+Alt+Down (also VS Code's "copy line down").
          { key: 'Shift-Alt-ArrowDown', run: copyLineDown },
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
  }, [filename, theme]); // eslint-disable-line react-hooks/exhaustive-deps

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
