"use client";

// FEEL-3a A5 — the agent run's narration surface: a live, collapsible step stream
// ("Liest index.html" / "Schreibt script.js · GEÄNDERT +14 −2" / "Sichert Entwurf ✓")
// and, when the run ends, the report card the ORCHESTRATOR assembled from tool
// results (files with real badges/deltas, landing state, units, follow-ups). Design
// tokens only (--ed-*), so it tracks the editor's light/dark theme.

import { useState, useEffect, useRef } from "react";
import { GoblinLogo } from "@/components/brand/GoblinLogo";
import { useLang, t } from "@/lib/use-lang";
import { pickQuote } from "@/lib/loading-quotes";
import type { AgentStep, AgentReport } from "@/hooks/code/useAgentRun";

// C3 — loading quotes. In an idle gap (no new real step for this long), a curated craft
// quote fades in BELOW the live step, then rotates. It is decoration, never a step:
// steps are truth. It only ever shows while streaming, and any new step clears it.
const IDLE_BEFORE_QUOTE_MS = 4000;
const QUOTE_ROTATE_MS = 7000;

/**
 * Show a rotating quote only during idle gaps of a live run. Returns the current quote
 * (or null when a real step is flowing / not streaming). Keyed on steps.length so every
 * new step resets the idle clock — the quote never competes with real narration.
 */
function useIdleQuote(streaming: boolean, stepCount: number): ReturnType<typeof pickQuote> | null {
  const [tick, setTick] = useState<number | null>(null);
  const seed = useRef(0);
  useEffect(() => {
    if (!streaming) { setTick(null); return; }
    setTick(null); // a new step (or run start) hides any current quote
    // Vary the starting quote per idle gap without a shared RNG dependency.
    seed.current = (seed.current + stepCount + 1) % 40;
    const show = setTimeout(() => setTick(0), IDLE_BEFORE_QUOTE_MS);
    const rotate = setInterval(() => setTick((n) => (n == null ? 0 : n + 1)), QUOTE_ROTATE_MS);
    return () => { clearTimeout(show); clearInterval(rotate); };
  }, [streaming, stepCount]);
  if (tick == null) return null;
  return pickQuote(seed.current + tick);
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

/** Live elapsed (seconds in) → "12s" or "1:05" once past a minute. */
function fmtElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/** C4: a per-tool glyph so the eye reads the KIND of step at a glance, not just its status. */
const TOOL_GLYPH: Record<string, string> = {
  list_files: "≣",
  read_file: "⌕",
  write_file: "✎",
  save_draft: "▣",
  publish: "▲",
  read_deploy_status: "◈",
  finish: "✓",
};

function StepRow({ step }: { step: AgentStep }) {
  const glyph = step.ok ? TOOL_GLYPH[step.tool] ?? "•" : "✗";
  return (
    <li
      data-testid="agent-step"
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", minWidth: 0, fontSize: 12.5, fontFamily: "var(--font-sans)" }}
    >
      <span
        aria-label={step.ok ? step.tool : `${step.tool} fehlgeschlagen`}
        title={step.tool}
        style={{ flexShrink: 0, color: step.ok ? "var(--ed-fg-3)" : "#B0432A", fontWeight: 700, width: 14, textAlign: "center", fontSize: step.ok ? 12 : 11 }}
      >
        {glyph}
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
  /** FEEL-3b D1: the confirmation chip — grants publish + resumes a publish-only run. */
  onConfirmPublish?: () => void;
}

export function AgentRunView({ streaming, steps, narration, report, elapsedSeconds, onViewChanges, onGoLive, onOpen, onConfirmPublish }: Props) {
  const lang = useLang();
  const [collapsed, setCollapsed] = useState(false);
  const toggledRef = useRef(false);
  const idleQuote = useIdleQuote(streaming, steps.length);

  // C4: long runs (>8 steps) collapse by default once finished, showing just the summary
  // line — unless the user has already opened/closed the list themselves.
  useEffect(() => {
    if (!streaming && report && steps.length > 8 && !toggledRef.current) setCollapsed(true);
  }, [streaming, report, steps.length]);

  if (!streaming && steps.length === 0 && !report) return null;

  const totalMs = steps.reduce((sum, s) => sum + s.ms, 0);

  const stateLabel = report
    ? report.state === "published"
      ? t(lang, "Live ✓ — veröffentlicht und geprüft", "Live ✓ — published and verified")
      : report.state === "draft-saved"
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
        onClick={() => { toggledRef.current = true; setCollapsed((c) => !c); }}
        aria-expanded={!collapsed}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", color: "var(--ed-fg-1)", textAlign: "left" }}
      >
        {streaming ? <GoblinLogo state="working" size={15} variant="gold" /> : <span aria-hidden style={{ width: 15, textAlign: "center", color: "var(--ed-fg-3)" }}>{collapsed ? "▸" : "▾"}</span>}
        <span style={{ fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font-sans)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {streaming
            ? (narration || t(lang, "Goblin arbeitet", "Goblin is working")) + (elapsedSeconds != null ? `… ${fmtElapsed(elapsedSeconds)}` : "…")
            : `${steps.length} ${steps.length === 1 ? t(lang, "Schritt", "step") : t(lang, "Schritte", "steps")}${totalMs > 0 ? ` · ${fmtMs(totalMs)}` : ""}`}
        </span>
      </button>

      {!collapsed && steps.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: "0 12px 8px 34px" }}>
          {steps.map((s, i) => <StepRow key={i} step={s} />)}
        </ul>
      )}

      {/* C3: idle-gap quote — BELOW the live step, secondary (serif, faint), a decoration
          that never pretends to be a step. Only while streaming, and any new step clears it. */}
      {!collapsed && streaming && idleQuote && (
        <p
          data-testid="agent-idle-quote"
          aria-hidden
          style={{
            margin: 0,
            padding: "0 12px 10px 34px",
            fontFamily: "var(--font-serif, Georgia, serif)",
            fontStyle: "italic",
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--ed-fg-3, var(--text-faint))",
            opacity: 0.85,
            transition: "opacity 240ms ease",
          }}
        >
          {t(lang, idleQuote.de, idleQuote.en)}
        </p>
      )}

      {/* Report card — assembled by the orchestrator from tool results */}
      {report && (
        <div data-testid="agent-report-card" style={{ borderTop: "1px solid var(--ed-rule)", padding: "12px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: report.state === "failed" ? "#B0432A" : (report.state === "published" || report.state === "draft-saved") ? "var(--ed-saved, #6db97b)" : "var(--ed-draft, #d4a737)" }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)" }}>{stateLabel}</span>
          </div>

          {/* Verified live URL — attested by the truth-gate (§5.1). */}
          {report.state === "published" && report.publishedUrl && (
            <a
              href={report.publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="agent-report-url"
              style={{ fontSize: 12, fontFamily: "JetBrains Mono, monospace", color: "var(--ed-primary, var(--brand-green))", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {report.publishedUrl}
            </a>
          )}

          {/* Honest failure reason (self-heal exhausted / build error / model unavailable). */}
          {report.state === "failed" && report.failureReason && (
            <p data-testid="agent-report-failure" style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "#B0432A", fontFamily: "var(--font-sans)" }}>{report.failureReason}</p>
          )}

          {/* C2: budget-forced finish — an honest pause, not a failure. Amber, not red. */}
          {report.outcome === "budget" && (
            <p data-testid="agent-report-budget" style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "var(--ed-draft, #9a6a00)", fontFamily: "var(--font-sans)" }}>
              {t(
                lang,
                "Ich habe hier pausiert — das Budget für diese Aufgabe war erreicht. Dein Entwurf ist gesichert; schreib mir „weiter“, dann mache ich dort weiter.",
                "I paused here — this task hit its budget. Your draft is saved; send “continue” and I'll pick up where I left off.",
              )}
            </p>
          )}

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
            {/* FEEL-3b D1 chip: one tap grants publish + resumes a publish-only run. */}
            {report.followUps.includes("confirm-publish") && (
              <button type="button" data-testid="report-confirm-publish" onClick={() => onConfirmPublish?.()} style={primaryBtn}>
                {t(lang, "Jetzt veröffentlichen", "Publish now")}
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
