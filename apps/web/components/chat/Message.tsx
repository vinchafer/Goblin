"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GoblinLogo } from "@/components/brand/GoblinLogo";
import { CodeBlock } from "./CodeBlock";
import { MessageIdContext } from "@/contexts/message-id-context";
import { chatModelLabel } from "@/lib/chat-model-label";
import { useLang } from "@/lib/use-lang";

export interface StandaloneMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  has_code: boolean;
  created_at: string;
  model_used?: string;
  source_tier?: string;
}

// F1.2 (feel-sprint-1): honest activity indicator. From send-accepted until the
// first token there was a dead window with no feedback (walk: up to 30s). This
// shows a truthful generic state with elapsed time — never named fake steps.
function WorkingIndicator({ since }: { since: string }) {
  const lang = useLang();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(since).getTime() || Date.now();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since]);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "2px 0" }}>
      <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 5, height: 5, borderRadius: "50%", display: "inline-block",
            background: "var(--ink-3)", animation: "bounce 1.2s ease infinite",
            animationDelay: `${i * 0.2}s`,
          }} />
        ))}
      </span>
      <span style={{ fontSize: 12.5, color: "var(--meta)", fontFamily: "var(--font-sans)" }}>
        {lang === "en" ? "Goblin is working…" : "Goblin arbeitet…"}{elapsed >= 2 ? ` ${elapsed}s` : ""}
      </span>
    </div>
  );
}

// react-markdown v9 drops the `inline` prop on `code`; block code is wrapped
// in <pre>. We override `pre` to a passthrough and decide block-vs-inline in
// `code` via a language- class or a contained newline, so fenced blocks render
// as <CodeBlock> and short spans stay inline.
// F1.3 — filename resolution for file cards: prefer the fence info-string meta
// ("```html index.html"), else a filename in the block's first comment line
// ("<!-- index.html -->", "// app.js"). Returns the code with a consumed
// comment line stripped, mirroring lib/parse-code-blocks.ts so Send-to-Code
// and the card show the same file.
const FILENAME_IN_META = /[A-Za-z0-9_\-./]+\.[A-Za-z0-9]+/;
function resolveCardFile(meta: string | undefined, code: string): { filename?: string; code: string } {
  const fromMeta = meta?.match(FILENAME_IN_META)?.[0];
  if (fromMeta) return { filename: fromMeta, code };
  const nl = code.indexOf("\n");
  const first = (nl >= 0 ? code.slice(0, nl) : code).trim();
  if (/^(<!--|\/\/|\/\*|#)/.test(first)) {
    const m = first.replace(/^<!--\s*|\s*-->$|^\/\*\s*|\s*\*\/$|^\/\/\s*|^#\s*/g, "").match(FILENAME_IN_META);
    if (m) return { filename: m[0], code: nl >= 0 ? code.slice(nl + 1) : "" };
  }
  return { code };
}

const MD_COMPONENTS = {
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  code: ({ className, children, node }: { className?: string; children?: React.ReactNode; node?: { data?: { meta?: string | null } } }) => {
    const text = String(children ?? "");
    const match = /language-(\w+)/.exec(className || "");
    const isBlock = Boolean(match) || text.includes("\n");
    if (!isBlock) {
      return <code className="inline-code">{children}</code>;
    }
    const raw = text.replace(/\n$/, "");
    const { filename, code } = resolveCardFile(node?.data?.meta ?? undefined, raw);
    // File-like blocks (named file, or a substantial fenced block) collapse to
    // a card; short snippets stay expanded so prose keeps its flow.
    const asCard = Boolean(filename) || code.split("\n").length > 8;
    return <CodeBlock code={code} lang={match?.[1]} filename={filename} asCard={asCard} />;
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
          <WorkingIndicator since={msg.created_at} />
        ) : (
          // B4: message id reaches nested CodeBlocks so the change line can be
          // persisted per message and re-rendered from storage after a reload.
          <MessageIdContext.Provider value={msg.id}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
              {msg.content}
            </ReactMarkdown>
          </MessageIdContext.Provider>
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
