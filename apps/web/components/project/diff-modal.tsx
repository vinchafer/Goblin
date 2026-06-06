"use client";

// Row 1 — the in-place review card (was: the 800px DiffModal).
// Same job, same apply path, better shape. File = one card; multiple changes =
// labelled hunks reviewable WITHIN the card (per-hunk ✕/✓), with a whole-file
// gesture as the fast default and discard preserved. Mobile = bottom sheet with
// a thumb bar; desktop = the same card, centred, clicked. Hunks are split
// mechanically (variant a) — see lib/diff-hunks.ts. The component keeps its name
// and existing props so the wiring in code-tab-classic.tsx is unchanged; it adds
// one optional callback (onApplyContent) for partial apply.

import { useMemo, useState } from "react";
import { useLang } from "@/lib/use-lang";
import { splitHunks, reconstructWithHunks, type Hunk } from "@/lib/diff-hunks";

interface DiffModalProps {
  filePath: string;
  currentContent: string;
  proposedContent: string;
  diff: string;
  /** Whole-file apply — the existing robust path (writes proposedContent). */
  onApply: () => void;
  onDiscard: () => void;
  /** Partial apply — writes a reconstructed subset. Falls back to onApply if absent. */
  onApplyContent?: (content: string) => void;
}

const Check = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
);
const Cross = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
);

type Decision = "accept" | "reject";

export function DiffModal({ filePath, currentContent, proposedContent, diff, onApply, onDiscard, onApplyContent }: DiffModalProps) {
  const lang = useLang();
  const hunks: Hunk[] = useMemo(() => splitHunks(diff, lang), [diff, lang]);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [failSafe, setFailSafe] = useState(false);

  const totalAdds = hunks.reduce((n, h) => n + h.addCount, 0);
  const totalDels = hunks.reduce((n, h) => n + h.delCount, 0);
  const hasChanges = hunks.length > 0;
  const multi = hunks.length > 1;

  const T = {
    review: lang === "en" ? "Review the change before you save" : "Prüf die Änderung, bevor du sicherst",
    hunks: lang === "en" ? "changes" : "Änderungen",
    discard: lang === "en" ? "Discard" : "Verwerfen",
    discardFile: lang === "en" ? "Discard file" : "Datei verwerfen",
    apply: lang === "en" ? "Apply" : "Übernehmen",
    wholeFile: lang === "en" ? "Whole file" : "Ganze Datei",
    noChanges: lang === "en" ? "Nothing to save." : "Keine Änderungen zu sichern.",
    perHunk: lang === "en" ? "Tap ✕ / ✓ per change — or take the whole file below" : "Pro Änderung ✕/✓ tippen — oder unten die ganze Datei",
    accepted: lang === "en" ? "kept" : "übernommen",
    rejected: lang === "en" ? "dropped" : "verworfen",
    failSafe: lang === "en"
      ? "Couldn't apply that selection cleanly. Your file is unchanged — take the whole file or discard."
      : "Teilauswahl ließ sich nicht sauber anwenden. Deine Datei ist unverändert — nimm die ganze Datei oder verwirf.",
  };

  // Commit once every hunk has a decision (the F3 auto-resolve model).
  function maybeCommit(next: Record<number, Decision>) {
    if (hunks.some(h => !next[h.index])) return; // not all decided yet
    const accepted = hunks.filter(h => next[h.index] === "accept").map(h => h.index);
    if (accepted.length === 0) { onDiscard(); return; }
    if (accepted.length === hunks.length) { onApply(); return; }   // all = robust whole-file path
    const content = reconstructWithHunks(currentContent, diff, accepted);
    if (content == null) { setFailSafe(true); return; }            // fail safe — never corrupt
    if (onApplyContent) onApplyContent(content); else onApply();
  }

  function decide(index: number, d: Decision) {
    setDecisions(prev => {
      const next = { ...prev, [index]: d };
      // defer commit to after state settles
      queueMicrotask(() => maybeCommit(next));
      return next;
    });
  }

  function renderDiffLines(h: Hunk) {
    return (
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "var(--t-caption-fs)", lineHeight: 1.7, padding: "4px 0" }}>
        {h.lines.map((l, i) => (
          <div key={i} style={{
            display: "flex", whiteSpace: "pre", padding: "0 12px",
            background: l.type === "add" ? "rgba(61,122,79,0.12)" : l.type === "del" ? "rgba(176,67,42,0.10)" : "transparent",
            boxShadow: l.type === "add" ? "inset 2px 0 0 var(--success)" : l.type === "del" ? "inset 2px 0 0 var(--danger)" : "none",
            color: l.type === "add" ? "#27623c" : l.type === "del" ? "#8f3622" : "var(--ink-3)",
          }}>
            <span style={{ width: 16, flexShrink: 0, textAlign: "center", userSelect: "none", color: l.type === "add" ? "var(--success)" : l.type === "del" ? "var(--danger)" : "var(--ink-disabled)" }}>
              {l.type === "add" ? "+" : l.type === "del" ? "−" : " "}
            </span>
            <span style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{l.content || " "}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "var(--surface-overlay)", backdropFilter: "blur(3px)" }}>
      <style>{`
        .gb-diffcard { position: fixed; left: 50%; top: 50%; transform: translate(-50%,-50%); width: min(540px, calc(100vw - 24px)); max-height: 85vh; border-radius: 16px; }
        @media (max-width: 640px) {
          .gb-diffcard { left: 0; right: 0; bottom: 0; top: auto; transform: none; width: 100%; max-height: 90vh; border-radius: 20px 20px 0 0; }
        }
      `}</style>
      <div
        className="gb-diffcard"
        role="dialog"
        aria-label={lang === "en" ? "Review change" : "Änderung prüfen"}
        data-testid="diff-review-card"
        style={{ background: "var(--surface-1)", border: "1px solid var(--rule-strong)", boxShadow: "0 24px 60px -20px rgba(15,43,30,0.34)", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        {/* Header */}
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "center", gap: 11, flexShrink: 0, background: "var(--surface-2)" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", border: "2px solid var(--warning)", boxSizing: "border-box", flexShrink: 0 }} title={lang === "en" ? "Draft" : "Entwurf"} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-1)", fontFamily: "JetBrains Mono, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{filePath}</div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-sans)", marginTop: 2 }}>
              {multi ? `${hunks.length} ${T.hunks}` : T.review}
              {hasChanges && <>{" · "}<span style={{ color: "var(--success)" }}>+{totalAdds}</span> <span style={{ color: "var(--danger)" }}>−{totalDels}</span></>}
            </div>
          </div>
          <button onClick={onDiscard} aria-label={lang === "en" ? "Close" : "Schließen"} style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", padding: 4, display: "flex" }}><Cross s={18} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", background: "var(--surface-1)", minHeight: 0 }}>
          {!hasChanges ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--ink-3)", fontSize: 13, fontFamily: "var(--font-sans)" }}>{T.noChanges}</div>
          ) : !multi && hunks[0] ? (
            renderDiffLines(hunks[0])
          ) : (
            <>
              <div style={{ padding: "8px 14px 2px", fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-sans)" }}>{T.perHunk}</div>
              {hunks.map(h => {
                const d = decisions[h.index];
                return (
                  <div key={h.index} style={{ borderTop: "1px solid var(--rule-soft)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "rgba(212,167,55,0.05)", opacity: d ? 0.65 : 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-1)", fontFamily: "var(--font-sans)" }}>{h.index + 1} · {h.label}</span>
                      <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "JetBrains Mono, monospace" }}>{h.loc}</span>
                      <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                        {d ? (
                          <span style={{ fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, color: d === "accept" ? "var(--success)" : "var(--danger)", fontFamily: "var(--font-sans)" }}>
                            {d === "accept" ? <Check s={13} /> : <Cross s={13} />}{d === "accept" ? T.accepted : T.rejected}
                          </span>
                        ) : (
                          <>
                            <button data-testid={`hunk-reject-${h.index}`} onClick={() => decide(h.index, "reject")} aria-label={`${T.discard} ${h.index + 1}`} className="touch-compact" style={{ width: 38, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)", background: "var(--surface-0)", color: "var(--danger)", cursor: "pointer" }}><Cross s={15} /></button>
                            <button data-testid={`hunk-accept-${h.index}`} onClick={() => decide(h.index, "accept")} aria-label={`${T.apply} ${h.index + 1}`} className="touch-compact" style={{ width: 38, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--success)", background: "var(--success)", color: "#fff", cursor: "pointer" }}><Check s={15} /></button>
                          </>
                        )}
                      </span>
                    </div>
                    {!d && renderDiffLines(h)}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Fail-safe banner */}
        {failSafe && (
          <div style={{ padding: "10px 14px", background: "var(--warning-soft)", borderTop: "1px solid var(--warning)", color: "var(--ink-2)", fontSize: 12, fontFamily: "var(--font-sans)", flexShrink: 0 }}>{T.failSafe}</div>
        )}

        {/* Thumb bar — whole-file accept (robust default) + discard, always available */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--rule)", display: "flex", gap: 10, flexShrink: 0, background: "var(--surface-2)" }}>
          <button data-testid="diff-discard" onClick={onDiscard} style={{ flex: 1, minHeight: 50, borderRadius: 14, background: "transparent", border: "1.5px solid color-mix(in srgb, var(--danger) 38%, transparent)", color: "var(--danger)", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Cross s={18} /> {multi ? T.discardFile : T.discard}
          </button>
          <button data-testid="diff-whole-accept" onClick={onApply} disabled={!hasChanges} style={{ flex: 1.5, minHeight: 50, borderRadius: 14, background: hasChanges ? "var(--success)" : "var(--surface-3)", border: "none", color: hasChanges ? "#fff" : "var(--ink-disabled)", fontSize: 15, fontWeight: 700, cursor: hasChanges ? "pointer" : "not-allowed", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: hasChanges ? "0 6px 16px -6px rgba(61,122,79,0.6)" : "none" }}>
            <Check s={18} /> {multi ? T.wholeFile : T.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
