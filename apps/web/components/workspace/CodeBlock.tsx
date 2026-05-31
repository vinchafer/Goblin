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
      {/* Header: language label + copy */}
      <div style={{
        background: '#1e1e1e',
        display: 'flex', alignItems: 'center',
        padding: '6px 14px', gap: 8,
      }}>
        <span style={{
          flex: 1, fontSize: 11, color: 'var(--text-faint)',
          fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.03em',
        }}>
          {label}
        </span>
        <button
          onClick={copy}
          title={copied ? 'Kopiert' : 'In Zwischenablage kopieren'}
          aria-label="In Zwischenablage kopieren"
          style={{
            background: 'none', border: 'none',
            color: copied ? 'var(--success)' : 'var(--text-faint)',
            fontSize: 11, cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            padding: '2px 8px', borderRadius: 4,
            transition: 'color 0.15s',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {copied ? (
            <>
              {/* lucide check */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Kopiert
            </>
          ) : (
            <>
              {/* lucide copy */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Kopieren
            </>
          )}
        </button>
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

      {/* Send to Code */}
      <button
        onClick={() => onSendToCode(code, targetFilename)}
        title={`An Code-Tab senden (${targetFilename})`}
        aria-label={`An Code-Tab senden als ${targetFilename}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          width: '100%', padding: '9px 14px',
          background: 'var(--brand-gold)', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: '#1a1200',
          fontFamily: 'var(--font-sans)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#e8b05a')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--brand-gold)')}
      >
        {/* lucide code */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
        </svg>
        An Code senden
      </button>
    </div>
  );
}
