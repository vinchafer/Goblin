'use client';

import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { highlight } from '@/lib/syntax/highlighter';

interface CodeBlockProps {
  code: string;
  lang?: string;
  filename?: string;
}

export function CodeBlock({ code, lang, filename }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    highlight(code, lang || 'text')
      .then(out => { if (active) setHtml(out); })
      .catch(() => { if (active) setHtml(null); });
    return () => { active = false; };
  }, [code, lang]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="codeblock cb-a">
      <div className="cb-head">
        <span className="cb-fname">{filename || lang || 'code'}</span>
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
  );
}
