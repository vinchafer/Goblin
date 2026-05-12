"use client";

import { useState } from "react";

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

  const label = filename || language || "code";

  return (
    <div style={{ margin: '10px 0', borderRadius: 10, overflow: 'hidden', border: '1px solid #2a2a2a' }}>
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
          style={{
            background: 'none', border: 'none',
            color: copied ? 'var(--success)' : 'var(--text-faint)',
            fontSize: 11, cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif',
            padding: '2px 8px', borderRadius: 4,
            transition: 'color 0.15s',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {copied ? (
            <><span>✓</span> Copied</>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy
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
        onClick={() => onSendToCode(code, filename || `${language || 'code'}-snippet`)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          width: '100%', padding: '9px 14px',
          background: 'var(--ochre)', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: '#fff',
          fontFamily: 'DM Sans, sans-serif',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#e8b05a')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--ochre)')}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="5 12 12 5 19 12"/><polyline points="5 19 12 12 19 19"/>
        </svg>
        Send to Code →
      </button>
    </div>
  );
}
