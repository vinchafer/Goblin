"use client";

import { Icon } from "@/components/ui/icon";
import type { CodeSession } from "@/hooks/code/useCodeSessions";

interface Props {
  sessions: CodeSession[];
  onPick: (sessionId: string) => void;
  onNewSession: () => void;
  onCancel: () => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "gerade eben";
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.floor(h / 24)} Tg.`;
}

/** "An welche Session senden?" — shown when 2+ sessions exist on Send-to-Code.
 *  Modal on desktop, full-screen sheet on mobile. */
export function SessionPickerDialog({ sessions, onPick, onNewSession, onCancel }: Props) {
  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.45)" }} />
      <div
        className="gb-session-picker"
        style={{
          position: "fixed", zIndex: 101, background: "var(--ed-chrome-2)", border: "1px solid var(--ed-rule)",
          boxShadow: "0 18px 48px rgba(15,43,30,0.32)",
        }}
      >
        <style>{`
          .gb-session-picker { top: 50%; left: 50%; transform: translate(-50%,-50%); width: 380px; max-width: calc(100vw - 32px); border-radius: 16px; padding: 20px; }
          @media (max-width: 640px) {
            .gb-session-picker { top: auto; bottom: 0; left: 0; transform: none; width: 100%; max-width: none; border-radius: 16px 16px 0 0; padding: 20px 16px calc(20px + env(safe-area-inset-bottom,0px)); }
          }
        `}</style>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)", marginBottom: 14 }}>
          An welche Session senden?
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "50vh", overflowY: "auto" }}>
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "1px solid var(--ed-rule)", borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-sans)" }}
            >
              <span style={{ width: 8, height: 8, background: "var(--ed-accent)", transform: "rotate(45deg)", borderRadius: 1, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, color: "var(--ed-fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--ed-fg-3)" }}>
                  {s.model_id ? `${s.model_id} · ` : ""}aktiv {relativeTime(s.updated_at)}
                </span>
              </span>
              {s.draftCount > 0 && <span style={{ width: 7, height: 7, borderRadius: "50%", border: "1.5px solid var(--ed-draft)", flexShrink: 0 }} />}
            </button>
          ))}
        </div>
        <button
          onClick={onNewSession}
          style={{ marginTop: 10, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, background: "transparent", border: "1px dashed var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 10, padding: "12px", fontSize: 13.5, cursor: "pointer", fontFamily: "var(--font-sans)" }}
        >
          <Icon name="add" size={14} /> Neue Session
        </button>
        <button
          onClick={onCancel}
          style={{ marginTop: 8, width: "100%", background: "transparent", border: "none", color: "var(--ed-fg-3)", borderRadius: 10, padding: "8px", fontSize: 13, cursor: "pointer", fontFamily: "var(--font-sans)" }}
        >
          Abbrechen
        </button>
      </div>
    </>
  );
}
