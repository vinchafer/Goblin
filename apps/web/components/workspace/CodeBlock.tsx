"use client";

import { useState } from "react";
import { detectFilename } from "@/lib/detect-filename";

interface CodeBlockProps {
  code: string;
  language: string;
  filename?: string;
  onSendToCode: (code: string, filename?: string) => void;
}

export function CodeBlock({ code, language, filename, onSendToCode }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // R1 fix: derive a real, deployable filename (index.html for HTML docs, etc.)
  // instead of the old extensionless "<lang>-snippet" that Build/Deploy rejected.
  const targetFilename = filename || detectFilename(code, language);
  const label = filename || language || "code";

  return (
    <div style={{ margin: '10px 0', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--ink-1)' }}>
      {/* Header: language label */}
      <div style={{
        background: '#1e1e1e',
        display: 'flex', alignItems: 'center',
        padding: '7px 14px', gap: 8,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{
          flex: 1, fontSize: 11, color: 'var(--text-faint)',
          fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.03em',
        }}>
          {label}
        </span>
      </div>

      {/* Code body */}
      <div style={{ background: '#0d1117', padding: '14px 16px', overflowX: 'auto' }}>
        <pre style={{
          margin: 0,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 13, color: '#e6edf3',
          lineHeight: 1.65, whiteSpace: 'pre',
        }}>
          <code>{code}</code>
        </pre>
      </div>

      {/* Action bar — equal-weight buttons, hierarchy by variant not size */}
      <div style={{
        background: '#161b22', borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
        padding: '8px 12px',
      }}>
        <button
          onClick={copy}
          title={copied ? 'Kopiert' : 'In Zwischenablage kopieren (⌘C)'}
          aria-label="In Zwischenablage kopieren"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 32, padding: '0 13px', borderRadius: 8,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.16)',
            color: copied ? 'var(--success)' : 'rgba(230,237,243,0.78)',
            fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'var(--font-sans)', transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {copied ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          )}
          {copied ? 'Kopiert' : 'Kopieren'}
        </button>
        <button
          onClick={() => onSendToCode(code, targetFilename)}
          title={`An Code-Tab senden (${targetFilename})`}
          aria-label={`An Code-Tab senden als ${targetFilename}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 32, padding: '0 14px', borderRadius: 8,
            background: 'rgba(212,167,55,0.16)',
            border: '1px solid rgba(212,167,55,0.55)',
            color: 'var(--brand-gold)',
            fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-sans)', transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,167,55,0.26)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(212,167,55,0.16)')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          An Code senden
        </button>
      </div>
    </div>
  );
}
