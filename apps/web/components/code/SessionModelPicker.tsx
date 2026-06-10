"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL, getToken } from "@/hooks/code/getToken";
import { Icon } from "@/components/ui/icon";

interface ModelOpt {
  slug: string;
  name: string;
  provider: string;
  available: boolean;
  keyConnected?: boolean | null;
}

interface Props {
  value: string | null;
  onChange: (slug: string) => void;
  /** compact = chip in the composer; full = wider button */
  variant?: "compact" | "full";
}

let _cache: ModelOpt[] | null = null;

/** Per-session model picker. Scoped to one session; reads /api/models. */
export function SessionModelPicker({ value, onChange, variant = "compact" }: Props) {
  const [models, setModels] = useState<ModelOpt[]>(_cache ?? []);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (_cache) return;
    (async () => {
      try {
        const t = await getToken();
        if (!t) return;
        const res = await fetch(`${API_URL}/api/models`, { headers: { Authorization: `Bearer ${t}` } });
        if (!res.ok) return;
        const data = await res.json();
        const list: ModelOpt[] = (data.models ?? data ?? []).map((m: Record<string, unknown>) => ({
          slug: String(m.slug ?? m.id), name: String(m.name ?? m.slug ?? m.id),
          provider: String(m.provider ?? ""), available: m.available !== false,
          keyConnected: (m.keyConnected as boolean | null | undefined) ?? null,
        }));
        _cache = list;
        setModels(list);
      } catch { /* silent — picker just shows the raw slug */ }
    })();
  }, []);

  // Only models the user can actually run today — connected BYOK keys plus
  // free-tier models. Hiding the rest is what fixes Max's "dropdown shows the
  // wrong models / connected ones unreachable" (B-S1). Server already sorts
  // connected-first.
  const usable = models.filter(m => m.available);

  // Auto-select a model when the session has none yet (e.g. right after
  // Send-to-Code lands code) so the user never faces an empty picker.
  //
  // BUG-11 (Walk-4): the old default was usable[0] = the top benchmark-ranked
  // usable model, which for a user with a Google key is "Gemini 2.5 Pro" — but
  // Gemini produced NOTHING on prod (verified: no content change, no review).
  // A cold code-tab send must succeed, so prefer the proven Groq Llama 3.3 70B
  // (the same model the dashboard chat defaults to and generates with), then any
  // Groq model, then fall back to the ranked top. The user can still pick any
  // model manually; this only sets the cold default.
  const autoPicked = useRef(false);
  useEffect(() => {
    if (autoPicked.current) return;
    if (!value && usable.length > 0) {
      autoPicked.current = true;
      const preferred =
        usable.find(m => /groq/i.test(m.provider) && /llama\s*3\.?3\s*70b/i.test(m.name)) ??
        usable.find(m => /groq/i.test(m.provider) && /llama/i.test(m.name)) ??
        usable.find(m => /groq/i.test(m.provider)) ??
        usable[0]!;
      onChange(preferred.slug);
    }
  }, [value, usable, onChange]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const current = models.find(m => m.slug === value);
  const label = current?.name ?? (value ? value : "Modell wählen");

  return (
    <div ref={ref} style={{ position: "relative" }} className="gb-model-picker">
      {/* WALK2-4 (Phase 4): when the composer is constrained (split-screen / narrow
          pane), collapse to an icon-only chip beside Send — the full-screen editor
          (wide container) keeps the labelled button. Container-query driven so it
          adapts to the editor PANE width, not just the viewport. */}
      <style>{`
        @container gb-composer (max-width: 360px) {
          .gb-model-picker .gb-mp-label, .gb-model-picker .gb-mp-chev { display: none; }
          .gb-model-picker .gb-mp-btn { padding: 6px 8px; }
        }
      `}</style>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={label}
        aria-label={`Modell: ${label}`}
        className="gb-mp-btn"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "transparent", border: "1px solid var(--ed-rule)", color: "var(--ed-fg-2)",
          borderRadius: 8, padding: variant === "compact" ? "5px 9px" : "7px 12px",
          fontSize: 12, fontFamily: "var(--font-sans)", cursor: "pointer", maxWidth: 200,
        }}
      >
        <Icon name="model" size={13} />
        <span className="gb-mp-label" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <Icon name={open ? "collapse" : "expand"} size={11} className="gb-mp-chev" />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 60,
            minWidth: 240, maxHeight: "min(50vh, 340px)", overflowY: "auto",
            WebkitOverflowScrolling: "touch", overscrollBehavior: "contain",
            background: "var(--ed-chrome-2)", border: "1px solid var(--ed-rule)", borderRadius: 10,
            boxShadow: "0 12px 32px rgba(15,43,30,0.24)", padding: 6,
          }}
        >
          {usable.length === 0 && (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)" }}>
              Keine verbundenen Modelle — verbinde einen Key in den Einstellungen.
            </div>
          )}
          {usable.map(m => (
            <button
              key={m.slug}
              type="button"
              onClick={() => { onChange(m.slug); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                background: m.slug === value ? "var(--ed-hover)" : "transparent", border: "none",
                color: "var(--ed-fg-1)", borderRadius: 7,
                padding: "8px 10px", fontSize: 12.5, fontFamily: "var(--font-sans)",
                cursor: "pointer",
              }}
            >
              {m.keyConnected && (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6db97b", flexShrink: 0 }} aria-hidden />
              )}
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
              <span style={{ fontSize: 10.5, color: "var(--ed-fg-3)" }}>{m.provider}</span>
              {m.slug === value && <Icon name="check" size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
