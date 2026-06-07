"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  INTENTS, intentDef, getStoredIntent, setStoredIntent, DEFAULT_INTENT, type Intent,
} from "@/lib/intent";

/**
 * The quiet "Layout wechseln" affordance (Sprint 10, Slice 1). Lives on the project
 * hub — accessible, not prominent. Changing intent re-sets the Code-Tab default
 * foreground on next mount. Never a mode: capabilities are identical across intents.
 *
 * Self-contained: resolves intent via API (+ localStorage hint) so the server hub
 * page need not select a column that may not exist pre-migration.
 */
export function ProjectIntentControl({ projectId }: { projectId: string }) {
  const supabase = createClient();
  const [intent, setIntent] = useState<Intent>(() => getStoredIntent(projectId) ?? DEFAULT_INTENT);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      try {
        const res = await fetch(`${apiBase}/api/projects/${projectId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok || cancelled) return;
        const p = await res.json();
        if (!cancelled && p?.intent) setIntent(p.intent as Intent);
      } catch { /* keep hint */ }
    })();
    return () => { cancelled = true; };
  }, [projectId, apiBase, supabase]);

  const choose = async (next: Intent) => {
    setIntent(next);
    setStoredIntent(projectId, next);
    setOpen(false);
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        await fetch(`${apiBase}/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ intent: next }),
        });
      }
    } catch { /* localStorage hint already set — non-fatal */ }
    setSaving(false);
  };

  const def = intentDef(intent);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="gobl-btn ghost lg"
        title="Standard-Layout des Code-Tabs für dieses Projekt"
        style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
      >
        {/* BUG-17 (Walk-4): "Layout: Nicht sicher" read like "insecure". Show the
            action instead — the dialog explains it's the Code-tab default layout. */}
        <def.icon size={15} /> Layout ändern
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", zIndex: 200 }}
          />
          <div
            role="dialog"
            aria-label="Layout wechseln"
            style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              background: "var(--panel)", borderRadius: 16, padding: 24, zIndex: 201,
              width: "min(460px, calc(100vw - 32px))", boxShadow: "var(--shadow-lg)",
            }}
          >
            <h2 style={{ fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 700, color: "var(--brand-green)", margin: "0 0 4px" }}>
              Layout wechseln
            </h2>
            <p style={{ fontSize: 13, color: "var(--meta)", margin: "0 0 16px", lineHeight: 1.5 }}>
              Setzt nur, was beim Öffnen des Code-Tabs im Vordergrund steht. Alle Werkzeuge bleiben jederzeit erreichbar.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {INTENTS.map((opt) => {
                const active = intent === opt.id;
                const I = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => choose(opt.id)}
                    aria-pressed={active}
                    style={{
                      position: "relative", textAlign: "left", display: "flex", flexDirection: "column", gap: 4,
                      padding: "11px 12px", borderRadius: 10, cursor: "pointer",
                      border: active ? "2px solid var(--brand-green)" : "1.5px solid var(--border)",
                      background: active ? "rgba(45,74,43,0.06)" : "var(--surface)",
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 7, color: active ? "var(--brand-green)" : "var(--text)" }}>
                      <I size={17} weight={active ? "fill" : "regular"} />
                      <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.15 }}>{opt.label}</span>
                    </span>
                    <span style={{ fontSize: 11, color: "var(--meta)", lineHeight: 1.35 }}>{opt.sub}</span>
                    {opt.comingSoon && (
                      <span style={{ position: "absolute", top: 8, right: 8, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "var(--brand-gold)", background: "rgba(212,167,55,0.14)", padding: "1px 5px", borderRadius: 4 }}>Bald</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <button type="button" onClick={() => setOpen(false)} className="gobl-btn ghost">Schließen</button>
            </div>
          </div>
        </>
      )}
      {saving && <span style={{ display: "none" }} aria-hidden />}
    </>
  );
}
