'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, ChevronDown, ChevronRight, FileCode2, FolderInput, Download, FileText } from 'lucide-react';
import { highlight } from '@/lib/syntax/highlighter';
import { useLang } from '@/lib/use-lang';
import { useExistingFiles } from '@/contexts/existing-files-context';
import { useCardSendToCode } from '@/contexts/send-to-code-context';
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

  // Document-class card? (md/txt filename, or a filename-less prose block.)
  // Gates "Als PDF speichern" AND — P1.4 — gives übernehmen a target path when
  // the model emitted a document with no explicit filename.
  const docExt = (() => {
    const e = filename ? filename.slice(filename.lastIndexOf('.') + 1).toLowerCase() : '';
    const l = (lang ?? '').toLowerCase();
    if (['md', 'markdown', 'txt'].includes(e)) return true;
    if (!filename && ['', 'markdown', 'md', 'text', 'plaintext'].includes(l)) return true;
    return false;
  })();
  // P1.4: derive a sensible target path for a filename-less document so it can be
  // taken into the project through the SAME STC pipeline as code cards. Founder
  // repro: a generated REPORT.md prose card offered only PDF/download/copy — no
  // "Ins Projekt übernehmen" — because übernehmen required an explicit filename.
  // Prefer the first markdown heading as the slug; fall back to Dokument.md.
  const deriveDocName = (): string => {
    const heading = code.match(/^\s*#\s+(.+?)\s*$/m)?.[1];
    const slug = heading
      ? heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
      : '';
    return `${slug || (langPref === 'en' ? 'document' : 'dokument')}.md`;
  };
  const stcTarget = filename || (docExt ? deriveDocName() : null);

  // C3: per-card "Ins Projekt übernehmen". Only when a chat host provides the
  // handler AND this card resolves to a target path (a real filename, or a
  // derived name for a filename-less document — P1.4).
  const onCardStc = useCardSendToCode();
  const canStc = !!onCardStc && !!stcTarget && code.trim().length > 0;
  const stcLabel = langPref === 'en' ? 'Add to project' : 'Ins Projekt übernehmen';
  const handleStc = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    if (stcTarget && onCardStc) onCardStc({ path: stcTarget, content: code });
  };
  const StcAction = canStc ? (
    <span
      role="button"
      tabIndex={0}
      data-testid="cb-add-to-project"
      onClick={handleStc}
      onKeyDown={(e) => { if (e.key === 'Enter') handleStc(e); }}
      aria-label={stcLabel}
      title={stcLabel}
      style={{ flexShrink: 0, display: 'inline-flex', color: 'var(--brand-green)', cursor: 'pointer' }}
    >
      <FolderInput size={14} />
    </span>
  ) : null;

  // C4a: per-card download in the card's native format + correct MIME.
  const mimeFor = (name: string): string => {
    const e = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
    const map: Record<string, string> = {
      html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript',
      mjs: 'text/javascript', ts: 'text/typescript', tsx: 'text/typescript',
      json: 'application/json', md: 'text/markdown', markdown: 'text/markdown',
      csv: 'text/csv', xml: 'application/xml', svg: 'image/svg+xml',
      txt: 'text/plain', yml: 'text/yaml', yaml: 'text/yaml', py: 'text/x-python',
    };
    return map[e] ?? 'text/plain';
  };
  const downloadName = filename || `${lang || 'code'}.txt`;
  const handleDownload = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    const blob = new Blob([code], { type: mimeFor(downloadName) });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = downloadName; a.click();
    URL.revokeObjectURL(url);
  };
  const dlLabel = langPref === 'en' ? 'Download' : 'Herunterladen';
  const DownloadAction = code.trim().length > 0 ? (
    <span
      role="button" tabIndex={0}
      data-testid="cb-download"
      onClick={handleDownload}
      onKeyDown={(e) => { if (e.key === 'Enter') handleDownload(e); }}
      aria-label={dlLabel} title={dlLabel}
      style={{ flexShrink: 0, display: 'inline-flex', color: 'var(--meta)', cursor: 'pointer' }}
    >
      <Download size={14} />
    </span>
  ) : null;

  // C4c: "Als PDF speichern" for document-class cards (md / plain prose) — opens a
  // clean print view; the browser / iOS print-to-PDF does the rest (no server PDF
  // rendering in v1). Gated to document outputs (docExt, computed above) so we
  // don't offer it on raw code.
  const pdfLabel = langPref === 'en' ? 'Save as PDF' : 'Als PDF speichern';
  const handlePrintPdf = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    try {
      sessionStorage.setItem('goblin:print-doc', JSON.stringify({
        title: filename || (langPref === 'en' ? 'Document' : 'Dokument'),
        content: code,
        format: /\.(md|markdown)$/i.test(filename ?? '') || (lang ?? '').toLowerCase().startsWith('md') ? 'md' : 'text',
      }));
      window.open('/dashboard/print', '_blank', 'noopener');
    } catch { /* ignore */ }
  };
  const PdfAction = docExt && code.trim().length > 0 ? (
    <span
      role="button" tabIndex={0}
      data-testid="cb-save-pdf"
      onClick={handlePrintPdf}
      onKeyDown={(e) => { if (e.key === 'Enter') handlePrintPdf(e); }}
      aria-label={pdfLabel} title={pdfLabel}
      style={{ flexShrink: 0, display: 'inline-flex', color: 'var(--meta)', cursor: 'pointer' }}
    >
      <FileText size={14} />
    </span>
  ) : null;

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
          {PdfAction}
          {DownloadAction}
          {StcAction}
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
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          {PdfAction}
          {DownloadAction}
          {StcAction}
          <button className="cb-copy" onClick={handleCopy} aria-label="Code kopieren" title="Code kopieren">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </span>
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
