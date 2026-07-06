"use client";

// FEEL-3a A5 — the agent run's narration surface: a live, collapsible step stream
// ("Liest index.html" / "Schreibt script.js · GEÄNDERT +14 −2" / "Sichert Entwurf ✓")
// and, when the run ends, the report card the ORCHESTRATOR assembled from tool
// results (files with real badges/deltas, landing state, units, follow-ups). Design
// tokens only (--ed-*), so it tracks the editor's light/dark theme.

import { useState } from "react";
import { GoblinLogo } from "@/components/brand/GoblinLogo";
import { useLang, t } from "@/lib/use-lang";
import type { AgentStep, AgentReport } from "@/hooks/code/useAgentRun";

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StepRow({ step }: { step: AgentStep }) {
  return (
    <li
      data-testid="agent-step"
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", minWidth: 0, fontSize: 12.5, fontFamily: "var(--font-sans)" }}
    >
      <span aria-hidden style={{ flexShrink: 0, color: step.ok ? "var(--ed-saved, #6db97b)" : "#B0432A", fontWeight: 700, width: 14, textAlign: "center" }}>
        {step.ok ? "✓" : "✗"}
      </span>
      <span style={{ color: "var(--ed-fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
        {step.summary || step.tool}
      </span>
      <span style={{ color: "var(--ed-fg-3)", flexShrink: 0, fontVariantNumeric: "tabular-nums", fontSize: 11 }}>{fmtMs(step.ms)}</span>
    </li>
  );
}

function Badge({ file }: { file: AgentReport["files"][number] }) {
  const lang = useLang();
  if (file.classification === "NEU") {
    return <span style={{ fontSize: 10.5, fontWeight: 700, color: "#2f7d43", background: "rgba(109,185,123,0.16)", borderRadius: 4, padding: "1px 6px" }}>{t(lang, "NEU", "NEW")}</span>;
  }
  if (file.classification === "GEÄNDERT") {
    return (
      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#9a6a00", background: "rgba(212,167,55,0.18)", borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" }}>
        {t(lang, "GEÄNDERT", "CHANGED")} +{file.added ?? 0} −{file.removed ?? 0}
      </span>
    );
  }
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ed-fg-3)" }}>{t(lang, "IDENTISCH", "IDENTICAL")}</span>;
}

interface Props {
  streaming: boolean;
  steps: AgentStep[];
  narration: string;
  report: AgentReport | null;
  elapsedSeconds?: number | null;
  onViewChanges?: (path: string) => void;
  onGoLive?: () => void;
  onOpen?: () => void;
}

export function AgentRunView({ streaming, steps, narration, report, elapsedSeconds, onViewChanges, onGoLive, onOpen }: Props) {
  const lang = useLang();
  const [collapsed, setCollapsed] = useState(false);
  if (!streaming && steps.length === 0 && !report) return null;

  const stateLabel = report
    ? report.state === "draft-saved"
      ? t(lang, "Entwurf gesichert — bereit zum Veröffentlichen", "Draft saved — ready to publish")
      : report.state === "draft-unsaved"
        ? t(lang, "Entwurf erstellt (noch nicht gesichert)", "Draft created (not yet saved)")
        : report.state === "stopped"
          ? t(lang, "Gestoppt — Teilstand gesichert", "Stopped — partial state kept")
          : t(lang, "Nicht abgeschlossen", "Did not complete")
    : "";

  const firstChanged = report?.files.find((f) => f.classification !== "IDENTISCH")?.path ?? report?.files[0]?.path;

  return (
    <div
      data-testid="agent-run-view"
      style={{ margin: "0 14px 10px", border: "1px solid var(--ed-rule)", borderRadius: 10, background: "var(--ed-chrome)", overflow: "hidden" }}
    >
      {/* Step stream header — collapsible */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", color: "var(--ed-fg-1)", textAlign: "left" }}
      >
        {streaming ? <GoblinLogo state="working" size={15} variant="gold" /> : <span aria-hidden style={{ width: 15, textAlign: "center", color: "var(--ed-fg-3)" }}>{collapsed ? "▸" : "▾"}</span>}
        <span style={{ fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font-sans)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {streaming
            ? (narration || t(lang, "Goblin arbeitet", "Goblin is working")) + (elapsedSeconds != null ? `… ${elapsedSeconds}s` : "…")
            : `${steps.length} ${steps.length === 1 ? t(lang, "Schritt", "step") : t(lang, "Schritte", "steps")}`}
        </span>
      </button>

      {!collapsed && steps.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: "0 12px 8px 34px" }}>
          {steps.map((s, i) => <StepRow key={i} step={s} />)}
        </ul>
      )}

      {/* Report card — assembled by the orchestrator from tool results */}
      {report && (
        <div data-testid="agent-report-card" style={{ borderTop: "1px solid var(--ed-rule)", padding: "12px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: report.state === "failed" ? "#B0432A" : report.state === "draft-saved" ? "var(--ed-saved, #6db97b)" : "var(--ed-draft, #d4a737)" }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)" }}>{stateLabel}</span>
          </div>

          {report.files.length > 0 && (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {report.files.map((f) => (
                <li key={f.path} data-testid="agent-report-file" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, fontFamily: "JetBrains Mono, monospace", color: "var(--ed-fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{f.path}</span>
                  <Badge file={f} />
                </li>
              ))}
            </ul>
          )}

          {report.modelText && (
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--ed-fg-2)", fontFamily: "var(--font-sans)", whiteSpace: "pre-wrap" }}>{report.modelText}</p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)" }}>
              {report.unitsConsumed.toLocaleString(lang === "de" ? "de-DE" : "en-US")} {t(lang, "Einheiten verbraucht", "units used")}
            </span>
            <span style={{ flex: 1 }} />
            {report.followUps.includes("view-changes") && firstChanged && (
              <button type="button" data-testid="report-view-changes" onClick={() => onViewChanges?.(firstChanged)} style={ghostBtn}>
                {t(lang, "Änderungen ansehen", "View changes")}
              </button>
            )}
            {report.followUps.includes("open") && (
              <button type="button" data-testid="report-open" onClick={() => onOpen?.()} style={ghostBtn}>
                {t(lang, "Öffnen", "Open")}
              </button>
            )}
            {report.followUps.includes("go-live") && (
              <button type="button" data-testid="report-go-live" onClick={() => onGoLive?.()} style={primaryBtn}>
                {t(lang, "Live stellen", "Go live")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  fontSize: 12, fontFamily: "var(--font-sans)", color: "var(--ed-fg-1)", background: "transparent",
  border: "1px solid var(--ed-rule)", borderRadius: 7, padding: "5px 11px", cursor: "pointer",
};
const primaryBtn: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, fontFamily: "var(--font-sans)", color: "var(--ed-on-primary, #fff)",
  background: "var(--ed-primary, var(--brand-green))", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer",
};
