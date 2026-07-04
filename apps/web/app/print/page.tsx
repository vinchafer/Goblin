'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLang } from '@/lib/use-lang';

/**
 * C4c — clean print-to-PDF view. A document-class file-card ("Als PDF speichern")
 * stashes { title, content, format } in sessionStorage and opens this page in a
 * new tab. It renders the content with a dedicated print stylesheet (Manrope,
 * sensible margins, no app chrome); the browser / iOS "Save as PDF" does the rest.
 * No server-side PDF rendering in v1 (deliberate — keeps it off Railway).
 */
interface PrintDoc {
  title: string;
  content: string;
  format: 'md' | 'text';
}

export default function PrintPage() {
  const lang = useLang();
  const [doc, setDoc] = useState<PrintDoc | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('goblin:print-doc');
      if (!raw) { setMissing(true); return; }
      setDoc(JSON.parse(raw) as PrintDoc);
    } catch {
      setMissing(true);
    }
  }, []);

  if (missing) {
    return (
      <div style={{ maxWidth: 720, margin: '80px auto', padding: '0 24px', fontFamily: 'Manrope, sans-serif', color: '#333' }}>
        {lang === 'en' ? 'Nothing to print — open this from a document card.' : 'Nichts zu drucken — öffne dies über eine Dokumentkarte.'}
      </div>
    );
  }
  if (!doc) return null;

  return (
    <div className="print-shell">
      <style>{`
        :root { color-scheme: light; }
        .print-shell {
          --ink: #1a1a1a;
          font-family: Manrope, var(--font-manrope), system-ui, sans-serif;
          color: var(--ink);
          background: #fff;
          max-width: 720px;
          margin: 0 auto;
          padding: 48px 40px 80px;
          line-height: 1.6;
        }
        .print-toolbar { margin-bottom: 28px; display: flex; gap: 12px; }
        .print-btn {
          font: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
          border: 1px solid #d8d2c4; background: #2d4a2b; color: #fff;
          border-radius: 8px; padding: 8px 16px;
        }
        .print-doc h1 { font-size: 28px; font-weight: 700; margin: 24px 0 12px; }
        .print-doc h2 { font-size: 22px; font-weight: 700; margin: 20px 0 10px; }
        .print-doc h3 { font-size: 18px; font-weight: 600; margin: 16px 0 8px; }
        .print-doc p { margin: 0 0 12px; }
        .print-doc ul, .print-doc ol { margin: 0 0 12px 24px; }
        .print-doc li { margin: 4px 0; }
        .print-doc code { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 0.9em; background: #f3f0e8; padding: 1px 5px; border-radius: 4px; }
        .print-doc pre { background: #f7f5ef; border: 1px solid #e8e3d6; border-radius: 8px; padding: 14px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; }
        .print-doc pre code { background: none; padding: 0; }
        .print-doc table { border-collapse: collapse; margin: 0 0 12px; }
        .print-doc th, .print-doc td { border: 1px solid #ddd; padding: 6px 10px; }
        .print-plain { white-space: pre-wrap; word-break: break-word; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 13.5px; }
        @page { margin: 18mm; }
        @media print {
          .print-toolbar { display: none !important; }
          .print-shell { max-width: none; margin: 0; padding: 0; }
        }
      `}</style>

      <div className="print-toolbar">
        <button className="print-btn" onClick={() => window.print()}>
          {lang === 'en' ? 'Save as PDF / Print' : 'Als PDF speichern / Drucken'}
        </button>
      </div>

      {doc.format === 'md' ? (
        <div className="print-doc">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
        </div>
      ) : (
        <div className="print-plain">{doc.content}</div>
      )}
    </div>
  );
}
