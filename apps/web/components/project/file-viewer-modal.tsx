"use client";

import { X, Copy, Check } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

interface FileViewerModalProps {
  open: boolean;
  onClose: () => void;
  path: string;
  content: string;
}

export function FileViewerModal({ open, onClose, path, content }: FileViewerModalProps) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const extension = path.split('.').pop() || 'text';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full m-4 max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--goblin-light)' }}>
          <span className="font-medium" style={{ color: 'var(--goblin-slate)' }}>{path}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-2 rounded hover:bg-gray-100 flex items-center gap-1 text-sm"
              style={{ color: 'var(--goblin-gray)' }}
            >
              {copied ? <Check className="w-4 h-4" style={{ color: 'var(--goblin-good)' }} /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={onClose} className="p-2 rounded hover:bg-gray-100">
              <X className="w-5 h-5" style={{ color: 'var(--goblin-gray)' }} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <SyntaxHighlighter
            style={oneDark}
            language={extension}
            customStyle={{ margin: 0, borderRadius: 0 }}
          >
            {content}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
}