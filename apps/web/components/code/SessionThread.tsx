"use client";

import { useState, useMemo } from "react";
import { Icon } from "@/components/ui/icon";
import { GoblinLogo } from "@/components/brand/GoblinLogo";
import type { EditorTheme } from "@/hooks/code/useEditorTheme";
import type { SessionMessage } from "@/hooks/code/useCodeSessionDetail";
import { parseCodeBlocks } from "@/lib/parse-code-blocks";
import { chatModelLabel } from "@/lib/chat-model-label";

interface Props {
  messages: SessionMessage[];
  streaming: boolean;
  streamingText: string;
  streamingModel: string | null;
  /** Editor theme → keeps the green brand mark visible (gold on warm-dark). */
  theme: EditorTheme;
  onViewFile: (path: string) => void;
  /** B.2: re-open the review card for a path ("Anwenden" on the turn). */
  onApplyFromChat: (path: string) => void;
  /** B.2: paths with a pending chat-driven review → show "Anwenden". */
  applicablePaths: Set<string>;
}

const COLLAPSED_COUNT = 3;

function fileSummary(content: string): { paths: string[]; prose: string } {
  const blocks = parseCodeBlocks(content);
  const paths = blocks.map(b => b.path);
  // Prose = text outside the code blocks, trimmed to one line.
  const prose = content.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim();
  return { paths, prose };
}

export function SessionThread({ messages, streaming, streamingText, streamingModel, theme, onViewFile, onApplyFromChat, applicablePaths }: Props) {
  const [expanded, setExpanded] = useState(false);

  // A.1: one chat look everywhere — the Goblin avatar is the brand mark (as in
  // the standalone chat), brand-GREEN on the light surface, GOLD on warm-dark
  // (where green #1A3A2A would vanish into the #3F3A2C canvas).
  const markVariant: "green" | "gold" = theme === "dark" ? "gold" : "green";

  const hiddenCount = Math.max(0, messages.length - COLLAPSED_COUNT);
  const visible = expanded ? messages : messages.slice(-COLLAPSED_COUNT);

  const streamingSummary = useMemo(() => fileSummary(streamingText), [streamingText]);

  // The file chip + (when reviewable) the "Anwenden" affordance on a Goblin turn.
  const fileRow = (p: string) => {
    const canApply = applicablePaths.has(p);
    return (
      <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => onViewFile(p)}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--ed-hover)", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-1)", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, cursor: "pointer", fontFamily: "JetBrains Mono, monospace" }}
        >
          <Icon name="code" size={13} /> {p} <span style={{ color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)" }}>· im Editor ansehen</span>
        </button>
        {canApply && (
          <button
            type="button"
            onClick={() => onApplyFromChat(p)}
            title="Änderung prüfen und anwenden"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--ed-primary)", border: "none", color: "var(--ed-on-primary)", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}
          >
            <Icon name="check" size={13} /> Anwenden
          </button>
        )}
      </div>
    );
  };

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
          // A.1: same right-aligned green bubble as the standalone chat.
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: "flex-end", maxWidth: "100%" }}>
              <div style={{ maxWidth: "76%", background: "var(--brand-green)", color: "#fff", borderRadius: "16px 4px 16px 16px", padding: "10px 14px", fontSize: 14, lineHeight: 1.6, fontFamily: "var(--font-sans)", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                {m.content}
              </div>
            </div>
          );
        }
        const { paths, prose } = fileSummary(m.content);
        return (
          // A.1: avatar + content row, mirroring the standalone chat message.
          <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", maxWidth: "100%" }}>
            <div style={{ flexShrink: 0, marginTop: 2, lineHeight: 0 }}>
              <GoblinLogo state="idle" size={22} variant={markVariant} />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)", fontWeight: 600 }}>
                {/* Two-level truth (H-2/HR-4): humanize — never the raw tier id /
                    slug (e.g. goblin/efficient). chatModelLabel → "Goblin Swift". */}
                {m.model_used ? chatModelLabel(m.model_used) : "Goblin"}
                {m.state === "error" && <span style={{ color: "var(--danger, #B0432A)" }}>· Fehler</span>}
              </span>
              {prose && <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ed-fg-2)", fontFamily: "var(--font-sans)", whiteSpace: "pre-wrap" }}>{prose}</div>}
              {paths.map(p => fileRow(p))}
            </div>
          </div>
        );
      })}

      {/* Live streaming turn — same avatar, thinking state. */}
      {streaming && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", maxWidth: "100%" }}>
          <div style={{ flexShrink: 0, marginTop: 2, lineHeight: 0 }}>
            <GoblinLogo state="thinking" size={22} variant={markVariant} />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)", fontWeight: 600 }}>
              {streamingModel ? chatModelLabel(streamingModel) : "Goblin"} <span style={{ fontWeight: 400, color: "var(--ed-accent)" }}>· schreibt …</span>
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
        </div>
      )}
    </div>
  );
}
