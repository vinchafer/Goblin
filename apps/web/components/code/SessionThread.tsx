"use client";

import { useState, useMemo } from "react";
import { Icon } from "@/components/ui/icon";
import { GoblinLogo } from "@/components/brand/GoblinLogo";
import type { SessionMessage } from "@/hooks/code/useCodeSessionDetail";
import { parseCodeBlocks } from "@/lib/parse-code-blocks";

interface Props {
  messages: SessionMessage[];
  streaming: boolean;
  streamingText: string;
  streamingModel: string | null;
  onViewFile: (path: string) => void;
}

const COLLAPSED_COUNT = 3;

/** ◇ gold eyebrow tick before Goblin turns — the app-wide mark. */
function Tick() {
  return (
    <span style={{ display: "inline-block", width: 8, height: 8, background: "var(--ed-accent)", transform: "rotate(45deg)", borderRadius: 1, flexShrink: 0 }} />
  );
}

function fileSummary(content: string): { paths: string[]; prose: string } {
  const blocks = parseCodeBlocks(content);
  const paths = blocks.map(b => b.path);
  // Prose = text outside the code blocks, trimmed to one line.
  const prose = content.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim();
  return { paths, prose };
}

export function SessionThread({ messages, streaming, streamingText, streamingModel, onViewFile }: Props) {
  const [expanded, setExpanded] = useState(false);

  const hiddenCount = Math.max(0, messages.length - COLLAPSED_COUNT);
  const visible = expanded ? messages : messages.slice(-COLLAPSED_COUNT);

  const streamingSummary = useMemo(() => fileSummary(streamingText), [streamingText]);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 16 }}>
      {messages.length === 0 && !streaming && (
        <div style={{ margin: "auto", textAlign: "center", maxWidth: 320, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)" }}>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            Noch nichts hier. Stell unten eine Aufgabe — oder öffne eine Datei aus dem Projekt.
          </div>
        </div>
      )}

      {hiddenCount > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{ alignSelf: "center", background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 999, padding: "5px 14px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)" }}
        >
          Verlauf einblenden ({hiddenCount})
        </button>
      )}

      {visible.map(m => {
        if (m.role === "user") {
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11.5, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)", fontWeight: 600 }}>Du</span>
              <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)", whiteSpace: "pre-wrap" }}>{m.content}</div>
            </div>
          );
        }
        const { paths, prose } = fileSummary(m.content);
        return (
          <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)", fontWeight: 600 }}>
              <Tick /> Goblin{m.model_used ? <span style={{ fontWeight: 400 }}>· {m.model_used}</span> : null}
              {m.state === "error" && <span style={{ color: "var(--danger, #B0432A)" }}>· Fehler</span>}
            </span>
            {prose && <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ed-fg-2)", fontFamily: "var(--font-sans)", whiteSpace: "pre-wrap" }}>{prose}</div>}
            {paths.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => onViewFile(p)}
                style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7, background: "var(--ed-hover)", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-1)", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, cursor: "pointer", fontFamily: "JetBrains Mono, monospace" }}
              >
                <Icon name="code" size={13} /> {p} <span style={{ color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)" }}>· im Editor ansehen</span>
              </button>
            ))}
          </div>
        );
      })}

      {/* Live streaming turn */}
      {streaming && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)", fontWeight: 600 }}>
            <GoblinLogo state="thinking" size={14} variant="gold" /> Goblin{streamingModel ? <span style={{ fontWeight: 400 }}>· {streamingModel}</span> : null} <span style={{ fontWeight: 400, color: "var(--ed-accent)" }}>· schreibt …</span>
          </span>
          {streamingSummary.prose && (
            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ed-fg-2)", fontFamily: "var(--font-sans)", whiteSpace: "pre-wrap" }}>{streamingSummary.prose}</div>
          )}
          {streamingSummary.paths.map(p => (
            <span key={p} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7, background: "var(--ed-hover)", border: "1px dashed var(--ed-draft)", color: "var(--ed-fg-1)", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontFamily: "JetBrains Mono, monospace" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", border: "1.5px solid var(--ed-draft)" }} /> {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
