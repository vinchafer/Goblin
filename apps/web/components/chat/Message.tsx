"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GoblinLogo } from "@/components/brand/GoblinLogo";
import { CodeBlock } from "./CodeBlock";
import { chatModelLabel } from "@/lib/chat-model-label";

export interface StandaloneMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  has_code: boolean;
  created_at: string;
  model_used?: string;
  source_tier?: string;
}

// react-markdown v9 drops the `inline` prop on `code`; block code is wrapped
// in <pre>. We override `pre` to a passthrough and decide block-vs-inline in
// `code` via a language- class or a contained newline, so fenced blocks render
// as <CodeBlock> and short spans stay inline.
const MD_COMPONENTS = {
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const text = String(children ?? "");
    const match = /language-(\w+)/.exec(className || "");
    const isBlock = Boolean(match) || text.includes("\n");
    if (!isBlock) {
      return <code className="inline-code">{children}</code>;
    }
    return <CodeBlock code={text.replace(/\n$/, "")} lang={match?.[1]} />;
  },
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  ),
};

export default function Message({ msg, isStreaming }: { msg: StandaloneMessage & { id: string }; isStreaming: boolean }) {
  if (msg.role === "user") {
    return <div className="msg-user">{msg.content}</div>;
  }

  // Assistant: mark (thinking for the whole stream per §B1.6 founder decision)
  // + content. Empty streaming placeholder shows bouncing dots until first token.
  const isThinking = msg.id === "streaming" && msg.content === "";

  return (
    <div className="msg-asst">
      <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(0)}40%{transform:scale(1)} }`}</style>
      <span className="msg-mark">
        <GoblinLogo state={isStreaming ? "thinking" : "idle"} variant="green" size={24} />
      </span>
      <div className="msg-content" data-streaming={isStreaming || undefined}>
        {isThinking ? (
          <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "var(--ink-3)", animation: "bounce 1.2s ease infinite",
                animationDelay: `${i * 0.2}s`,
              }} />
            ))}
          </div>
        ) : (
          <>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
              {msg.content}
            </ReactMarkdown>
          </>
        )}

        {msg.model_used && !isStreaming && chatModelLabel(msg.model_used) && (
          // Two-level truth (H-2/HR-4): show ONLY the human label — never the raw
          // tier id (goblin/efficient·premium) or the source_tier (goblin_hosted…).
          <div style={{ marginTop: 4, fontSize: "var(--t-caption-fs)", color: "var(--meta)", fontFamily: "var(--font-sans)" }}>
            {chatModelLabel(msg.model_used)}
          </div>
        )}
      </div>
    </div>
  );
}
