"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { CodeSession } from "@/hooks/code/useCodeSessions";
import type { EditorTheme } from "@/hooks/code/useEditorTheme";

interface Props {
  sessions: CodeSession[];
  activeId: string | null;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  theme: EditorTheme;
  onToggleTheme: () => void;
  /** NAVFIX-5 (Phase B): belt-and-suspenders escape from the code tab on mobile,
   *  in case the sidebar overlay is ever trapped under the full-height surface. */
  onBackToProject?: () => void;
}

function Tick() {
  return <span style={{ display: "inline-block", width: 7, height: 7, background: "var(--ed-accent)", transform: "rotate(45deg)", borderRadius: 1, flexShrink: 0 }} />;
}

/** Session tabs at the top of the Code Tab. Desktop = horizontal strip; mobile =
 *  a single chip that opens a bottom sheet (no persistent bottom-tab-bar). */
export function SessionTabs({ sessions, activeId, onSwitch, onCreate, onDelete, theme, onToggleTheme, onBackToProject }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const active = sessions.find(s => s.id === activeId);

  return (
    <div style={{ flexShrink: 0, borderBottom: "1px solid var(--ed-rule)", background: "var(--ed-chrome)" }}>
      <style>{`
        .gb-sessiontabs-desktop { display: flex; }
        .gb-sessiontabs-mobile { display: none; }
        @media (max-width: 860px) {
          .gb-sessiontabs-desktop { display: none !important; }
          .gb-sessiontabs-mobile { display: flex !important; }
        }
      `}</style>

      {/* Desktop strip */}
      <div className="gb-sessiontabs-desktop" style={{ alignItems: "center", gap: 4, padding: "6px 8px", overflowX: "auto" }}>
        {sessions.map(s => {
          const isActive = s.id === activeId;
          return (
            <div
              key={s.id}
              onClick={() => onSwitch(s.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer",
                background: isActive ? "var(--ed-canvas)" : "transparent",
                border: `1px solid ${isActive ? "var(--ed-rule)" : "transparent"}`,
                borderBottomColor: isActive ? "var(--ed-canvas)" : "transparent",
                borderRadius: "8px 8px 0 0", padding: "7px 11px", fontSize: 13,
                fontFamily: "var(--font-sans)", color: isActive ? "var(--ed-fg-1)" : "var(--ed-fg-2)",
                whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              <Tick />
              <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
              {s.draftCount > 0 && (
                <span style={{ width: 7, height: 7, borderRadius: "50%", border: "1.5px solid var(--ed-draft)", flexShrink: 0 }} title={`${s.draftCount} Entwurf`} />
              )}
              {s.model_id && <span style={{ fontSize: 10.5, color: "var(--ed-fg-3)", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis" }}>{s.model_id}</span>}
              {sessions.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                  aria-label="Session schliessen"
                  style={{ background: "none", border: "none", color: "var(--ed-fg-3)", cursor: "pointer", display: "inline-flex", padding: 0, marginLeft: 2 }}
                >
                  <Icon name="close" size={12} />
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={onCreate}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "1px dashed var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-sans)", whiteSpace: "nowrap", flexShrink: 0 }}
        >
          <Icon name="add" size={13} /> Neue Session
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={onToggleTheme}
          aria-label={theme === "light" ? "Dunkel" : "Hell"}
          title={theme === "light" ? "Dunkles Editor-Thema" : "Helles Editor-Thema"}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)", flexShrink: 0 }}
        >
          <Icon name={theme === "light" ? "moon" : "sun"} size={14} /> {theme === "light" ? "Dunkel" : "Hell"}
        </button>
      </div>

      {/* Mobile chip */}
      <div className="gb-sessiontabs-mobile" style={{ alignItems: "center", gap: 8, padding: "8px 12px" }}>
        {onBackToProject && (
          <button
            onClick={onBackToProject}
            aria-label="Zurück zum Projekt"
            title="Zurück zum Projekt"
            style={{ flexShrink: 0, background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 8, padding: "8px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
          >
            <Icon name="back" size={15} />
          </button>
        )}
        <button
          onClick={() => setSheetOpen(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--ed-canvas)", border: "1px solid var(--ed-rule)", borderRadius: 999, padding: "7px 13px", fontSize: 13, color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)", cursor: "pointer", flex: 1, minWidth: 0 }}
        >
          <Tick />
          <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{active?.name ?? "Sessions"}</span>
          {active && active.draftCount > 0 && <span style={{ width: 7, height: 7, borderRadius: "50%", border: "1.5px solid var(--ed-draft)" }} />}
          <Icon name="expand" size={13} />
        </button>
        <button onClick={onToggleTheme} aria-label={theme === "light" ? "Dunkel" : "Hell"} style={{ background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)", borderRadius: 8, padding: "8px", cursor: "pointer", display: "inline-flex" }}>
          <Icon name={theme === "light" ? "moon" : "sun"} size={15} />
        </button>
      </div>

      {/* Mobile sheet */}
      {sheetOpen && (
        <>
          <div onClick={() => setSheetOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 96, background: "var(--ed-chrome-2)", borderRadius: "16px 16px 0 0", borderTop: "1px solid var(--ed-rule)", padding: "16px 16px calc(16px + env(safe-area-inset-bottom,0px))", maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)", marginBottom: 12 }}>Sessions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sessions.map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => { onSwitch(s.id); setSheetOpen(false); }}
                    style={{ flex: 1, display: "inline-flex", alignItems: "center", gap: 8, background: s.id === activeId ? "var(--ed-hover)" : "transparent", border: "1px solid var(--ed-rule)", borderRadius: 10, padding: "11px 13px", fontSize: 14, color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)", cursor: "pointer", textAlign: "left" }}
                  >
                    <Tick />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                    {s.draftCount > 0 && <span style={{ width: 7, height: 7, borderRadius: "50%", border: "1.5px solid var(--ed-draft)" }} />}
                  </button>
                  {sessions.length > 1 && (
                    <button onClick={() => onDelete(s.id)} aria-label="Löschen" style={{ background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-3)", borderRadius: 8, padding: "10px", cursor: "pointer", display: "inline-flex" }}>
                      <Icon name="delete" size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => { onCreate(); setSheetOpen(false); }}
              style={{ marginTop: 12, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, background: "var(--ed-primary)", color: "var(--ed-on-primary)", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}
            >
              <Icon name="add" size={15} /> Neue Session
            </button>
          </div>
        </>
      )}
    </div>
  );
}
