"use client";

// MOBILE-1 · M1 — the promoted command bar (spec §2.1).
//
// The primary way code changes on a phone: "Goblin um eine Änderung bitten…"
// moved from the buried footer to the TOP of the mobile Code surface, with the
// mic beside it (dictation via useDictation — CHAT-IO C1). Routes through the
// SAME chat→edit path as before; the model output still lands as a reviewed
// GEÄNDERT draft (no auto-apply). Optionally pre-anchored (M3) with a chip
// showing `file · Zeile a–b`.
//
// Deliberately NOT auto-focused: opening the Code surface must never grab the
// keyboard (MOBILE-1 tier philosophy — the AI is the keyboard, but only when
// the user reaches for it). Top placement also means focusing the field never
// pushes the layout up behind the on-screen keyboard (the old bottom-docked
// bar's jump). Reuses the editor-surface `--ed-*` tokens so it tracks the
// light/dark editor theme.

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { GoblinLogo } from "@/components/brand/GoblinLogo";
import { SessionModelPicker } from "./SessionModelPicker";
import { useDictation } from "@/hooks/use-dictation";
import { useLang, t } from "@/lib/use-lang";

export interface CommandAnchor {
  file: string;
  /** 1-based inclusive line range shown in the chip. */
  from: number;
  to: number;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (text: string) => void;
  streaming: boolean;
  onCancel?: () => void;
  modelId?: string | null;
  onModelChange: (modelId: string) => void;
  /** M3: pre-anchored instruction target. Renders a dismissible chip. */
  anchor?: CommandAnchor | null;
  onClearAnchor?: () => void;
  /** Extra className for placement/visibility gating from the parent. */
  className?: string;
}

export function CommandBar({
  value, onChange, onSubmit, streaming, onCancel,
  modelId, onModelChange, anchor, onClearAnchor, className,
}: Props) {
  const lang = useLang();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // P1.2(a): the command input is an auto-growing textarea — grows with the
  // instruction up to ~4 lines, then scrolls internally. A single-line <input>
  // showed only 4–5 words of a longer request (founder-reproduced), so the user
  // couldn't see what they'd typed. maxH ≈ 4 lines of the 16px/1.4 field.
  const MAX_TEXTAREA_H = 112;
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_H)}px`;
  }, [value]);
  // Dictation appends to whatever was typed so far (never auto-sends). Snapshot
  // the pre-dictation text on start; each transcript update rewrites the tail.
  const dictationBaseRef = useRef<string>("");
  const [dictationErr, setDictationErr] = useState<string | null>(null);

  const { status, toggle } = useDictation({
    lang,
    onStart: () => { dictationBaseRef.current = value; setDictationErr(null); },
    onTranscript: (text) => {
      const base = dictationBaseRef.current;
      onChange(base ? `${base.replace(/\s*$/, "")} ${text}` : text);
    },
    onError: (msg) => setDictationErr(msg),
  });
  const recording = status === "listening";
  const processing = status === "processing";

  const submit = () => {
    const text = value.trim();
    if (!text || streaming) return;
    onSubmit(text);
  };

  const canSend = !!value.trim() && !streaming;

  return (
    <form
      className={`gb-command-bar${className ? ` ${className}` : ""}`}
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      style={{
        flexShrink: 0, borderBottom: "1px solid var(--ed-rule)",
        background: "var(--ed-chrome)", padding: "8px 12px",
        display: "flex", flexDirection: "column", gap: 8,
      }}
    >
      {anchor && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            data-testid="command-anchor-chip"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%",
              background: "var(--ed-canvas)", border: "1px solid var(--ed-rule)",
              borderRadius: 6, padding: "3px 8px", fontFamily: "JetBrains Mono, monospace",
              fontSize: 11.5, color: "var(--ed-fg-2)",
            }}
          >
            <Icon name="code" size={12} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {anchor.file} · {t(lang, "Zeile", "Line")} {anchor.from}{anchor.to !== anchor.from ? `–${anchor.to}` : ""}
            </span>
            {onClearAnchor && (
              <button
                type="button" onClick={onClearAnchor} aria-label={t(lang, "Auswahl aufheben", "Clear selection")}
                style={{ background: "transparent", border: "none", color: "var(--ed-fg-3)", cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 0 }}
              >
                <Icon name="close" size={12} />
              </button>
            )}
          </span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter inserts a newline (the textarea grows).
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
          rows={1}
          placeholder={t(lang, "Goblin um eine Änderung bitten…", "Ask Goblin for a change…")}
          aria-label={t(lang, "Goblin um eine Änderung bitten", "Ask Goblin for a change")}
          disabled={streaming}
          data-testid="command-bar-input"
          style={{
            flex: 1, minWidth: 0, background: "var(--ed-canvas)", border: "1px solid var(--ed-rule)",
            color: "var(--ed-fg-1)", borderRadius: 9, padding: "10px 12px", fontSize: 16,
            fontFamily: "var(--font-sans)", outline: "none", resize: "none",
            lineHeight: 1.4, maxHeight: MAX_TEXTAREA_H, overflowY: "auto",
            opacity: streaming ? 0.6 : 1,
          }}
        />
        {/* Mic — reuse dictation (CHAT-IO C1). Inserts at the field; never auto-sends. */}
        <button
          type="button"
          onClick={() => toggle()}
          disabled={streaming || processing}
          aria-label={recording ? t(lang, "Aufnahme stoppen", "Stop recording") : t(lang, "Spracheingabe", "Voice input")}
          title={recording ? t(lang, "Aufnahme stoppen", "Stop recording") : t(lang, "Spracheingabe", "Voice input")}
          data-testid="command-bar-mic"
          style={{
            flexShrink: 0, width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--ed-rule)",
            background: recording ? "rgba(176,67,42,0.12)" : "transparent",
            color: recording ? "var(--danger, #B0432A)" : "var(--ed-fg-2)",
            cursor: streaming ? "not-allowed" : "pointer", display: "inline-flex",
            alignItems: "center", justifyContent: "center",
            boxShadow: recording ? "0 0 0 2px rgba(176,67,42,0.35)" : "none",
            opacity: streaming ? 0.5 : 1,
          }}
        >
          {processing ? <GoblinLogo state="working" size={16} variant="gold" /> : <Icon name="mic" size={18} />}
        </button>
        <SessionModelPicker value={modelId ?? null} onChange={onModelChange} variant="icon" />
        {streaming && onCancel ? (
          <button
            type="button" onClick={onCancel} aria-label={t(lang, "Abbrechen", "Cancel")}
            style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, background: "transparent", color: "var(--ed-fg-2)", border: "1px solid var(--ed-rule)", borderRadius: 9, cursor: "pointer" }}
          >
            <GoblinLogo state="working" size={15} variant="gold" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label={t(lang, "Senden", "Send")}
            data-testid="command-bar-send"
            style={{
              flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 44, height: 44, borderRadius: 9,
              background: canSend ? "var(--ed-primary)" : "transparent",
              color: canSend ? "var(--ed-on-primary)" : "var(--ed-fg-3)",
              border: canSend ? "none" : "1px solid var(--ed-rule)",
              cursor: canSend ? "pointer" : "not-allowed",
            }}
          >
            <Icon name="send" size={16} />
          </button>
        )}
      </div>
      {(recording || dictationErr) && (
        <span style={{ fontSize: 12, fontFamily: "var(--font-sans)", color: dictationErr ? "var(--danger, #B0432A)" : "var(--ed-fg-3)" }}>
          {dictationErr ?? t(lang, "Goblin hört zu …", "Listening…")}
        </span>
      )}
    </form>
  );
}
