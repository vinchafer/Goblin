'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, ChevronDown, ChevronRight, FileCode2 } from 'lucide-react';
import { highlight } from '@/lib/syntax/highlighter';
import { useLang } from '@/lib/use-lang';
import { useExistingFiles } from '@/contexts/existing-files-context';
import { useMessageId } from '@/contexts/message-id-context';
import { classifyFile, lineDelta, type LineDelta } from '@/lib/file-compare';
import { saveChangeNote, loadChangeNote } from '@/lib/change-note-store';

interface CodeBlockProps {
  code: string;
  lang?: string;
  filename?: string;
  /**
   * F1.3 — file-card mode: render as a collapsed card (filename, language,
   * live line count, expand/copy) instead of a raw scrolling block. Streaming
   * keeps filling the card; the collapsed line count ticks up live.
   */
  asCard?: boolean;
}

export function CodeBlock({ code, lang, filename, asCard }: CodeBlockProps) {
  const langPref = useLang();
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(!asCard);

  // U2: change summary vs. the bound project's current files — "ändert
  // index.html · +12 −3" under the card. Debounced so token-by-token streaming
  // doesn't diff on every render; null = new file / identical / no project.
  // B4: the live delta is persisted per message id at completion; on reload
  // (or once the file was saved and live diffing yields nothing) the stored
  // delta keeps the line rendered.
  const existingFiles = useExistingFiles();
  const messageId = useMessageId();
  const persistedId = messageId && messageId !== 'streaming' ? messageId : null;
  const [change, setChange] = useState<LineDelta | null>(null);
  useEffect(() => {
    if (!filename) { setChange(null); return; }
    const stored = persistedId ? loadChangeNote(persistedId, filename) : null;
    const prev = existingFiles?.[filename];
    if (prev == null) { setChange(stored); return; }
    const t = setTimeout(() => {
      const live = classifyFile(prev, code) === 'changed' ? lineDelta(prev, code) : null;
      if (live && persistedId) saveChangeNote(persistedId, filename, live);
      setChange(live ?? stored);
    }, 300);
    return () => clearTimeout(t);
  }, [filename, code, existingFiles, persistedId]);

  const changeNote = change && filename ? (
    <div
      data-testid="cb-change-note"
      style={{ margin: '3px 0 0 6px', fontSize: 11.5, color: 'var(--meta)', fontFamily: 'var(--font-sans)' }}
    >
      ändert {filename} · <span style={{ fontFamily: 'var(--font-mono)' }}>+{change.added} −{change.removed}</span>
    </div>
  ) : null;

  useEffect(() => {
    // Only pay for highlighting when the code is actually visible.
    if (!expanded) return;
    let active = true;
    highlight(code, lang || 'text')
      .then(out => { if (active) setHtml(out); })
      .catch(() => { if (active) setHtml(null); });
    return () => { active = false; };
  }, [code, lang, expanded]);

  const handleCopy = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    await navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lineCount = code === '' ? 0 : code.split('\n').length;
  const title = filename || lang || 'code';

  if (asCard && !expanded) {
    return (
      <>
      <div className="codeblock cb-a" style={{ overflow: 'hidden' }}>
        <button
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '10px 12px', background: 'none', border: 'none',
            cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)',
          }}
        >
          <ChevronRight size={14} style={{ color: 'var(--meta)', flexShrink: 0 }} />
          <FileCode2 size={15} style={{ color: 'var(--brand-green)', flexShrink: 0 }} />
          <span className="cb-fname" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--meta)', flexShrink: 0 }}>
            {lang && filename ? `${lang} · ` : ''}{lineCount} {langPref === 'en' ? 'lines' : 'Zeilen'}
          </span>
          <span
            role="button"
            tabIndex={0}
            className="cb-copy"
            onClick={handleCopy}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCopy(); }}
            aria-label="Code kopieren"
            title="Code kopieren"
            style={{ flexShrink: 0, display: 'inline-flex' }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </span>
        </button>
      </div>
      {changeNote}
      </>
    );
  }

  return (
    <>
    <div className="codeblock cb-a">
      <div className="cb-head">
        {asCard ? (
          <button
            onClick={() => setExpanded(false)}
            aria-expanded
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none',
              border: 'none', cursor: 'pointer', padding: 0, color: 'inherit',
              fontFamily: 'inherit', minWidth: 0,
            }}
          >
            <ChevronDown size={14} style={{ color: 'var(--meta)' }} />
            <span className="cb-fname">{title}</span>
            <span style={{ fontSize: 11.5, color: 'var(--meta)' }}>
              {lineCount} {langPref === 'en' ? 'lines' : 'Zeilen'}
            </span>
          </button>
        ) : (
          <span className="cb-fname">{title}</span>
        )}
        <button className="cb-copy" onClick={handleCopy} aria-label="Code kopieren" title="Code kopieren">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <div className="cb-body">
        {html
          ? <div dangerouslySetInnerHTML={{ __html: html }} />
          : <pre><code>{code}</code></pre>}
      </div>
    </div>
    {changeNote}
    </>
  );
}
