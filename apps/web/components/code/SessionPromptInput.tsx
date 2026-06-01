"use client";

import { useRef, useState, useEffect } from "react";
import { Icon } from "@/components/ui/icon";
import { GoblinMark } from "@/components/ui/goblin-mark";
import { SessionModelPicker } from "./SessionModelPicker";

interface Props {
  modelId: string | null;
  onModelChange: (slug: string) => void;
  onSubmit: (prompt: string) => void;
  streaming: boolean;
  onCancel: () => void;
  autoFocus?: boolean;
}

/**
 * The in-tab AI composer — pinned at the bottom of a session pane. Type a prompt,
 * pick a model, ⏎ to send (Shift+⏎ = newline). On mobile it sits above the keyboard
 * (safe-area inset), never flush to the screen's bottom edge.
 */
export function SessionPromptInput({ modelId, onModelChange, onSubmit, streaming, onCancel, autoFocus }: Props) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) taRef.current?.focus();
  }, [autoFocus]);

  const autoGrow = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 8 * 22 + 16) + "px";
  };

  const send = () => {
    const v = value.trim();
    if (!v || streaming) return;
    onSubmit(v);
    setValue("");
    requestAnimationFrame(() => { if (taRef.current) taRef.current.style.height = "auto"; });
  };

  return (
    <div
      style={{
        flexShrink: 0, borderTop: "1px solid var(--ed-rule)", background: "var(--ed-chrome)",
        padding: "10px 12px calc(10px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div
        style={{
          border: "1px solid var(--ed-rule)", borderRadius: 12, background: "var(--ed-canvas)",
          padding: 8, display: "flex", flexDirection: "column", gap: 8,
        }}
      >
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); autoGrow(); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder="Sag Goblin, was zu tun ist …"
          rows={1}
          style={{
            resize: "none", border: "none", outline: "none", background: "transparent",
            color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.5,
            width: "100%", maxHeight: 8 * 22 + 16, overflowY: "auto",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SessionModelPicker value={modelId} onChange={onModelChange} variant="compact" />
          <div style={{ flex: 1 }} />
          {streaming ? (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Stoppen"
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, background: "transparent",
                border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 9,
                padding: "7px 12px", fontSize: 13, cursor: "pointer", fontFamily: "var(--font-sans)",
              }}
            >
              <GoblinMark size={15} /> Stoppen
            </button>
          ) : (
            <button
              type="button"
              onClick={send}
              disabled={!value.trim()}
              aria-label="Senden"
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: value.trim() ? "var(--ed-primary)" : "var(--ed-rule-soft)",
                color: value.trim() ? "var(--ed-on-primary)" : "var(--ed-fg-3)",
                border: "none", borderRadius: 9, padding: "7px 14px", fontSize: 13, fontWeight: 600,
                cursor: value.trim() ? "pointer" : "not-allowed", fontFamily: "var(--font-sans)",
              }}
            >
              <Icon name="send" size={14} /> Senden
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
