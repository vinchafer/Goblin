"use client";

// TRIAL-7 T2 — the achievement-triggered upgrade card. Appears exactly ONCE per
// user, at the earned moment: their first truth-gated successful publish (the
// deploy verification passing — never deploy-started, never a draft save). It
// celebrates and offers; it never blocks, never nags, never fakes urgency.
//
// Two placements share this component:
//  · "slot"  — inline in the mobile status-strip JIT slot (takes precedence over
//              the per-project JIT card on this one publish).
//  · "toast" — a floating dismissible card on the work surface (the desktop path,
//              where the mobile status strip is hidden). Spec §T2 "toast-card variant".
//
// Copy is honest and traces to real plan facts: paid access does not expire, and
// the monthly unit allowance is larger than the trial's. No invented claims.

import { useLang, t } from "@/lib/use-lang";

interface Props {
  variant: "slot" | "toast";
  onUpgrade: () => void;
  onLater: () => void;
}

export function AchievementUpgradeCard({ variant, onUpgrade, onLater }: Props) {
  const lang = useLang();

  const eyebrow = t(lang, "DEINE APP IST LIVE", "YOUR APP IS LIVE");
  const body = t(
    lang,
    "Genau dafür ist Goblin gebaut. Mit einem Plan bleibst du dran — mehr Einheiten pro Monat, und dein Zugang endet nicht.",
    "This is exactly what Goblin is for. With a plan you keep going — more units each month, and your access doesn't end.",
  );
  const cta = t(lang, "Pläne ansehen", "See plans");
  const later = t(lang, "Später", "Later");

  const laterBtn = (
    <button
      onClick={onLater} data-testid="achievement-later"
      style={{ flexShrink: 0, background: "transparent", border: "none", color: "var(--ed-fg-3)", fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-sans)", padding: "6px 8px" }}
    >
      {later}
    </button>
  );
  const upgradeBtn = (
    <button
      onClick={onUpgrade} data-testid="achievement-upgrade"
      style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, background: "var(--ed-primary)", border: "none", color: "var(--ed-on-primary)", borderRadius: 8, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}
    >
      {cta}
    </button>
  );

  if (variant === "slot") {
    return (
      <div
        data-testid="achievement-card" data-variant="slot"
        style={{
          display: "flex", alignItems: "center", gap: 11, width: "100%",
          background: "rgba(212,169,74,0.10)", border: "1px solid rgba(212,169,74,0.42)", borderRadius: 10,
          padding: "9px 11px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#b88a20", fontFamily: "var(--font-sans)", marginBottom: 2 }}>
            {eyebrow}
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.4, color: "var(--ed-fg-2)", fontFamily: "var(--font-sans)" }}>
            {body}
          </div>
        </div>
        {laterBtn}
        {upgradeBtn}
      </div>
    );
  }

  // toast — floating, dismissible, on the work surface (desktop + fallback).
  return (
    <div
      data-testid="achievement-card" data-variant="toast"
      style={{
        position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
        zIndex: 92, maxWidth: 460, width: "calc(100% - 32px)",
        background: "var(--ed-chrome-2, var(--ed-canvas))", border: "1px solid rgba(212,169,74,0.42)",
        borderRadius: 12, padding: "13px 15px", boxShadow: "0 10px 32px rgba(15,43,30,0.28)",
        display: "flex", flexDirection: "column", gap: 9,
      }}
    >
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#b88a20", fontFamily: "var(--font-sans)" }}>
        {eyebrow}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ed-fg-1)", fontFamily: "var(--font-sans)" }}>
        {body}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
        {laterBtn}
        {upgradeBtn}
      </div>
    </div>
  );
}
