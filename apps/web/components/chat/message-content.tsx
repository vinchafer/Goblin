"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Copy, Check, ArrowRight, ArrowUpRight } from "@phosphor-icons/react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/contexts/app-context";

interface MessageContentProps {
  content: string;
  messageId?: string;
  role?: "user" | "assistant";
}

export function MessageContent({ content, messageId, role }: MessageContentProps) {
  // Extract code blocks from content
  const codeBlocks = extractCodeBlocks(content);
  const hasCodeBlocks = codeBlocks.length > 0;
  const isPromptLike = !hasCodeBlocks && role === "assistant" && content.length > 20;

  return (
    <div>
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isBlock = match || String(children).includes('\n');
            const codeValue = String(children).replace(/\n$/, '');
            const lang = match?.[1] ?? 'text';
            return isBlock && match ? (
              <CodeBlock
                language={lang}
                value={codeValue}
                messageId={messageId}
              />
            ) : (
              <code
                className={`${className} px-1.5 py-0.5 rounded text-sm`}
                style={{ backgroundColor: 'rgba(212, 169, 74, 0.15)' }}
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="text-sm leading-relaxed mb-3 last:mb-0" style={{ color: 'var(--goblin-slate)' }}>{children}</p>;
          }
        }}
      >
        {content}
      </ReactMarkdown>

      {/* Prompt-like message: single Send to Code button for entire message */}
      {isPromptLike && messageId && (
        <SendToCodeButton
          payload={content}
          payloadType="prompt"
          messageId={messageId}
          label="→ Send to Code"
        />
      )}
    </div>
  );
}

const LANG_TO_EXT: Record<string, string> = {
  typescript: 'ts', javascript: 'js', tsx: 'tsx', jsx: 'jsx',
  python: 'py', rust: 'rs', go: 'go', java: 'java',
  css: 'css', scss: 'scss', html: 'html', json: 'json',
  sql: 'sql', bash: 'sh', shell: 'sh', yaml: 'yml', markdown: 'md',
};

function CodeBlock({ language, value, messageId }: { language: string; value: string; messageId?: string }) {
  const [copied, setCopied] = useState(false);
  const { setPendingCodePayload, setActiveTab } = useApp();
  const filenameHint = LANG_TO_EXT[language] ? `file.${LANG_TO_EXT[language]}` : undefined;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ margin: '10px 0', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', background: 'var(--code-bg)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: 'var(--code-fg)', fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '0.05em', opacity: 0.8,
        }}>
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, background: 'none',
            border: 'none', cursor: 'pointer', color: copied ? '#5aac4b' : 'rgba(255,255,255,0.45)',
            fontSize: 11, fontFamily: 'DM Sans, sans-serif', padding: '2px 0',
            transition: 'color 0.15s',
          }}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {/* Code body */}
      <div style={{ overflowX: 'auto' }}>
        <SyntaxHighlighter
          style={oneDark}
          language={language}
          customStyle={{ margin: 0, borderRadius: 0, minWidth: 'max-content', fontSize: 13, lineHeight: 1.6, background: 'var(--code-root)' }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
      {/* Footer: Send to Code */}
      <div style={{ background: 'var(--code-root-2)', padding: '6px 10px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => { setPendingCodePayload({ content: value, filename: filenameHint }); setActiveTab('code'); }}
          style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: 'var(--ochre)', color: '#1a1000', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'DM Sans, sans-serif',
            transition: 'opacity 0.15s',
          }}
          onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseOut={e => (e.currentTarget.style.opacity = '1')}
        >
          <ArrowUpRight className="w-3 h-3" />
          Send to Code
        </button>
      </div>
    </div>
  );
}

interface SendToCodeButtonProps {
  payload: string;
  payloadType: "code" | "prompt" | "mixed";
  messageId: string;
  filename?: string;
  label: string;
}

function SendToCodeButton({ payload, payloadType, messageId, filename, label }: SendToCodeButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const params = useParams();
  const projectId = params?.id as string;

  const handleSend = useCallback(async () => {
    if (!projectId || status !== "idle") return;

    setStatus("loading");

    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setStatus("idle");
        return;
      }

      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBase}/api/chat/send-to-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          messageId,
          payload,
          payloadType,
          filename,
        }),
      });

      if (response.ok) {
        setStatus("sent");
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("idle");
      }
    } catch {
      setStatus("idle");
    }
  }, [projectId, messageId, payload, payloadType, status]);

  const buttonText =
    status === "loading" ? "Sending..."
    : status === "sent" ? "✓ Sent"
    : label;

  return (
    <button
      onClick={handleSend}
      disabled={status !== "idle"}
      className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 min-h-[44px]"
      style={{
        backgroundColor: status === "sent" ? "#4A7C3B" : "#D4A94A",
        color: status === "sent" ? "#FFFFFF" : "#3A2E1F",
        opacity: status === "loading" ? 0.7 : 1,
        cursor: status === "idle" ? "pointer" : "default",
      }}
    >
      {status === "loading" ? (
        <span className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#3A2E1F", borderTopColor: "transparent" }} />
      ) : status === "sent" ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <ArrowRight className="w-3.5 h-3.5" />
      )}
      {buttonText}
    </button>
  );
}

/** Extract code blocks from markdown content */
function extractCodeBlocks(markdown: string): { language: string; code: string }[] {
  const blocks: { language: string; code: string }[] = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const lang = match[1];
    const code = match[2];
    if (code) {
      blocks.push({
        language: lang || "text",
        code: code.trim(),
      });
    }
  }
  return blocks;
}