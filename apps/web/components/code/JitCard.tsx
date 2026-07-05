"use client";

// MOBILE-1 · M6 — the Just-in-Time integration card (spec §5). Lives in the
// status-strip slot; appears at the earned moment (post-publish), dismissible.

import { Icon } from "@/components/ui/icon";
import { useLang, t } from "@/lib/use-lang";
import type { JitKind } from "@/lib/jit-cards";

interface Props {
  kind: JitKind;
  onSetup: () => void;
  onLater: () => void;
}

export function JitCard({ kind, onSetup, onLater }: Props) {
  const lang = useLang();
  const copy = kind === "github"
    ? {
        icon: "github" as const,
        text: t(lang, "Dein Projekt ist live. Willst du es zusätzlich auf GitHub sichern?", "Your project is live. Want to also back it up on GitHub?"),
      }
    : {
        icon: "web" as const,
        text: t(lang, "Schon dreimal live. Willst du eine eigene Domain verbinden?", "Live three times now. Want to connect your own domain?"),
      };
  return (
    <div
      data-testid="jit-card" data-kind={kind}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        background: "var(--ed-canvas)", border: "1px solid var(--ed-rule)", borderRadius: 10,
        padding: "9px 11px",
      }}
    >
      <Icon name={copy.icon} size={16} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.4, color: "var(--ed-fg-2)", fontFamily: "var(--font-sans)" }}>
        {copy.text}
      </span>
      <button
        onClick={onLater} data-testid="jit-later"
        style={{ flexShrink: 0, background: "transparent", border: "none", color: "var(--ed-fg-3)", fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-sans)", padding: "6px 8px" }}
      >
        {t(lang, "Später", "Later")}
      </button>
      <button
        onClick={onSetup} data-testid="jit-setup"
        style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, background: "var(--ed-primary)", border: "none", color: "var(--ed-on-primary)", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}
      >
        {t(lang, "Einrichten", "Set up")}
      </button>
    </div>
  );
}
