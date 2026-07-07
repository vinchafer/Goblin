"use client";

// F4.1 (feel-4): the per-project "Anweisungen & Gedächtnis" card on the project
// hub. Two trust features in one panel:
//   1. Anweisungen — free text ≤2k chars, injected above the rolling memory as
//      the user's own binding rules (see api renderProjectContext).
//   2. Gedächtnis — the rolling project_state made visible (read-only "Stand &
//      Entscheidungen") and controllable ("Gedächtnis zurücksetzen" clears it).
// Control beats mystery: the user sees exactly what Goblin remembers and can wipe it.

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang, t } from "@/lib/use-lang";
import { ConfirmDialog } from "@/components/manage/ManageDialogs";

const MAX_CHARS = 2000;

type MemoryState = { summary: string; decisions: string; updatedAt: string | null };

export function ProjectInstructionsCard({ projectId }: { projectId: string }) {
  const lang = useLang();
  const supabase = createClient();
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";

  const [instructions, setInstructions] = useState("");
  const [savedInstructions, setSavedInstructions] = useState("");
  const [memory, setMemory] = useState<MemoryState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const token = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, [supabase]);

  const loadMemory = useCallback(async () => {
    const tk = await token();
    if (!tk) return;
    try {
      const res = await fetch(`${apiBase}/api/projects/${projectId}/state`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      if (res.ok) setMemory((await res.json()) as MemoryState);
    } catch { /* leave memory as-is */ }
  }, [apiBase, projectId, token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tk = await token();
      if (!tk) { setLoaded(true); return; }
      try {
        const [ri, rs] = await Promise.all([
          fetch(`${apiBase}/api/projects/${projectId}/instructions`, { headers: { Authorization: `Bearer ${tk}` } }),
          fetch(`${apiBase}/api/projects/${projectId}/state`, { headers: { Authorization: `Bearer ${tk}` } }),
        ]);
        if (cancelled) return;
        if (ri.ok) {
          const v = ((await ri.json()) as { instructions?: string }).instructions ?? "";
          setInstructions(v);
          setSavedInstructions(v);
        }
        if (rs.ok) setMemory((await rs.json()) as MemoryState);
      } catch { /* honest empty state */ }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [apiBase, projectId, token]);

  const save = async () => {
    setSaving(true);
    try {
      const tk = await token();
      if (tk) {
        const res = await fetch(`${apiBase}/api/projects/${projectId}/instructions`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
          body: JSON.stringify({ instructions: instructions.slice(0, MAX_CHARS) }),
        });
        if (res.ok) {
          setSavedInstructions(instructions.slice(0, MAX_CHARS));
          setSavedFlash(true);
          setTimeout(() => setSavedFlash(false), 2000);
        }
      }
    } catch { /* non-fatal */ }
    setSaving(false);
  };

  const doReset = async () => {
    try {
      const tk = await token();
      if (tk) {
        await fetch(`${apiBase}/api/projects/${projectId}/state`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${tk}` },
        });
      }
    } catch { /* non-fatal */ }
    setConfirmReset(false);
    setMemory({ summary: "", decisions: "", updatedAt: null });
    void loadMemory();
  };

  const dirty = instructions !== savedInstructions;
  const overLimit = instructions.length > MAX_CHARS;
  const hasMemory = !!(memory && (memory.summary || memory.decisions));

  const label: React.CSSProperties = {
    fontFamily: "var(--font-dash-display), Manrope, sans-serif",
    fontWeight: 600, fontSize: 15, letterSpacing: "-0.014em",
    color: "var(--ink-1)", margin: 0,
  };

  return (
    <div className="gobl-panel" style={{ overflow: "hidden", alignSelf: "stretch" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
        <h2 style={label}>{t(lang, "Anweisungen & Gedächtnis", "Instructions & memory")}</h2>
      </div>

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* ── Anweisungen ─────────────────────────────────────────────── */}
        <div>
          <p style={{ fontSize: 13, color: "var(--ink-2)", margin: "0 0 8px", lineHeight: 1.5 }}>
            {t(lang,
              "Feste Vorgaben für dieses Projekt. Goblin befolgt sie in jedem Chat und Agent-Lauf — ohne dass du sie wiederholen musst.",
              "Standing rules for this project. Goblin follows them in every chat and agent run — no need to repeat them.")}
          </p>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            maxLength={MAX_CHARS + 200 /* soft guard; hard cap enforced on save */}
            rows={5}
            placeholder={t(lang,
              "z. B.: Immer deutsches UI. Keine externen Fonts. Farbschema: dunkelgrün.",
              "e.g.: Always German UI. No external fonts. Color scheme: dark green.")}
            disabled={!loaded}
            style={{
              width: "100%", boxSizing: "border-box", resize: "vertical",
              padding: "10px 12px", borderRadius: "var(--radius, 10px)",
              border: `1px solid ${overLimit ? "var(--danger)" : "var(--line)"}`,
              background: "var(--d-surface-elev)", color: "var(--ink-1)",
              fontFamily: "var(--font-sans)", fontSize: 13.5, lineHeight: 1.5,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 12 }}>
            <span style={{ fontSize: 11.5, color: overLimit ? "var(--danger)" : "var(--ink-3)", fontFamily: "JetBrains Mono, monospace" }}>
              {instructions.length} / {MAX_CHARS}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {savedFlash && (
                <span style={{ fontSize: 12, color: "#6db97b", fontWeight: 600 }}>
                  {t(lang, "Gespeichert", "Saved")}
                </span>
              )}
              <button
                type="button"
                onClick={save}
                disabled={!dirty || overLimit || saving || !loaded}
                className="gobl-btn primary"
                style={{ opacity: !dirty || overLimit || saving ? 0.5 : 1 }}
              >
                {saving ? t(lang, "Speichern…", "Saving…") : t(lang, "Speichern", "Save")}
              </button>
            </div>
          </div>
        </div>

        {/* ── Gedächtnis (Stand & Entscheidungen) ─────────────────────── */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <h3 style={{ ...label, fontSize: 13.5 }}>{t(lang, "Stand & Entscheidungen", "State & decisions")}</h3>
            {hasMemory && (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="gobl-btn ghost"
                style={{ fontSize: 12, color: "var(--rust, #B4451F)" }}
              >
                {t(lang, "Gedächtnis zurücksetzen", "Reset memory")}
              </button>
            )}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: "0 0 10px", lineHeight: 1.45 }}>
            {t(lang,
              "Was Goblin sich aus früheren Chats zu diesem Projekt gemerkt hat. Wird nach jeder Antwort automatisch aktualisiert.",
              "What Goblin has remembered from earlier chats on this project. Updated automatically after each reply.")}
          </p>
          {!loaded ? (
            <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0 }}>{t(lang, "Lade…", "Loading…")}</p>
          ) : hasMemory ? (
            <div style={{
              background: "var(--d-surface-elev)", border: "1px solid var(--line)",
              borderRadius: "var(--radius, 10px)", padding: "12px 14px",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              {memory!.summary && (
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-3)", marginBottom: 3 }}>
                    {t(lang, "Stand", "State")}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-1)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{memory!.summary}</div>
                </div>
              )}
              {memory!.decisions && (
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-3)", marginBottom: 3 }}>
                    {t(lang, "Entscheidungen", "Decisions")}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-1)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{memory!.decisions}</div>
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0, fontStyle: "italic" }}>
              {t(lang, "Noch kein gespeicherter Stand.", "No stored state yet.")}
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title={t(lang, "Gedächtnis zurücksetzen?", "Reset memory?")}
        body={t(lang,
          "Goblin vergisst den gespeicherten Stand und die Entscheidungen zu diesem Projekt. Deine Dateien, Chats und Anweisungen bleiben unberührt. Das lässt sich nicht rückgängig machen.",
          "Goblin forgets the stored state and decisions for this project. Your files, chats, and instructions are untouched. This cannot be undone.")}
        confirmLabel={t(lang, "Zurücksetzen", "Reset")}
        cancelLabel={t(lang, "Abbrechen", "Cancel")}
        onConfirm={doReset}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  );
}
