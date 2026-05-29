'use client';
import { useState, useEffect, useCallback } from 'react';
import type { EditorView } from 'codemirror';
import {
  indentMore,
  indentLess,
  undo,
  redo,
  toggleComment,
} from '@codemirror/commands';
import {
  ArrowLineRight,
  ArrowLineLeft,
  ArrowCounterClockwise,
  ArrowClockwise,
  Hash,
  FloppyDisk,
  Keyboard,
} from '@phosphor-icons/react';

interface ToolbarButton {
  icon: React.ReactNode;
  label: string;
  action: () => void;
}

interface FloatingToolbarProps {
  editorView: EditorView | null;
  onSave?: () => void;
}

export function FloatingToolbar({ editorView, onSave }: FloatingToolbarProps) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    if (!('visualViewport' in window)) return;

    const vv = window.visualViewport!;
    const handler = () => {
      const kbHeight = window.innerHeight - vv.height;
      setKeyboardHeight(kbHeight);
      setKeyboardVisible(kbHeight > 80);
    };

    vv.addEventListener('resize', handler);
    vv.addEventListener('scroll', handler);
    return () => {
      vv.removeEventListener('resize', handler);
      vv.removeEventListener('scroll', handler);
    };
  }, [isMobile]);

  const dispatch = useCallback((cmd: (view: EditorView) => boolean) => {
    if (!editorView) return;
    cmd(editorView);
    editorView.focus();
  }, [editorView]);

  const buttons: ToolbarButton[] = [
    { icon: <ArrowLineRight size={16} weight="bold" />, label: 'Indent', action: () => dispatch(indentMore) },
    { icon: <ArrowLineLeft size={16} weight="bold" />, label: 'Outdent', action: () => dispatch(indentLess) },
    { icon: <Hash size={16} weight="bold" />, label: 'Comment', action: () => dispatch(toggleComment) },
    { icon: <ArrowCounterClockwise size={16} weight="bold" />, label: 'Undo', action: () => dispatch(undo) },
    { icon: <ArrowClockwise size={16} weight="bold" />, label: 'Redo', action: () => dispatch(redo) },
    { icon: <FloppyDisk size={16} weight="bold" />, label: 'Save', action: () => onSave?.() },
  ];

  if (!isMobile || !keyboardVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: keyboardHeight,
        left: 0,
        right: 0,
        height: 44,
        background: 'var(--code-bg, #1E2A1C)',
        borderTop: '1px solid var(--green-700)',
        display: 'flex',
        alignItems: 'center',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        zIndex: 200,
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {buttons.map(btn => (
        <button
          key={btn.label}
          onPointerDown={e => {
            e.preventDefault();
            btn.action();
          }}
          aria-label={btn.label}
          title={btn.label}
          style={{
            flex: '0 0 52px',
            height: 44,
            background: 'none',
            border: 'none',
            borderRight: '1px solid var(--green-700)',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}
          onPointerEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onPointerLeave={e => (e.currentTarget.style.background = 'none')}
        >
          {btn.icon}
        </button>
      ))}

      <div style={{ flex: 1 }} />

      <button
        onPointerDown={e => { e.preventDefault(); editorView?.contentDOM.blur(); }}
        aria-label="Dismiss keyboard"
        style={{
          flex: '0 0 52px',
          height: 44,
          background: 'none',
          border: 'none',
          borderLeft: '1px solid var(--green-700)',
          color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <Keyboard size={16} weight="bold" />
      </button>
    </div>
  );
}
