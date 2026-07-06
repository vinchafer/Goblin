"use client";

// MOBILE-1 · M1 — the status strip (spec §2.2), sits directly beneath the
// promoted command bar on the mobile Code surface.
//
// Three things, honestly: the draft state ("Nicht veröffentlichte Änderungen ·
// N Dateien"), the truth-gated last publish ("Live · <url>" — shown ONLY when a
// real deploy is on record, never a hopeful claim), and the JIT card slot
// (§5) which stays empty until M6 earns it. Feeling invariant: never claim
// published state that hasn't been verified — `deployed` is driven by the
// server's recorded deploy, not by a click.

import type { ReactNode } from "react";
import { GoblinLogo } from "@/components/brand/GoblinLogo";
import { useLang, t } from "@/lib/use-lang";

export type SurfaceState = "empty" | "draft" | "saved" | "deployed";

interface Props {
  state: SurfaceState;
  draftCount: number;
  /** P1.2(b): while a command is running, the strip shows "Goblin arbeitet… <n>s"
      so the user can see something is happening on the Code surface. Null = idle. */
  workingSeconds?: number | null;
  /** Public deploy URL — only present when the project has actually been deployed. */
  liveUrl?: string | null;
  /** Compact relative time of the last deploy, e.g. "vor 3min". */
  lastDeployedRel?: string | null;
  /** M6 JIT card slot. Null until earned (first successful publish). */
  jit?: ReactNode;
  className?: string;
}

export function StatusStrip({ state, draftCount, workingSeconds, liveUrl, lastDeployedRel, jit, className }: Props) {
  const lang = useLang();
  const working = workingSeconds != null;

  return (
    <div
      className={`gb-status-strip${className ? ` ${className}` : ""}`}
      data-testid="status-strip"
      style={{
        flexShrink: 0, borderBottom: "1px solid var(--ed-rule)", background: "var(--ed-chrome)",
        padding: "7px 14px", display: "flex", flexDirection: "column", gap: 7,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span
          data-testid="status-strip-state"
          style={{ fontSize: 12.5, fontFamily: "var(--font-sans)", display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0, flex: 1 }}
        >
          {working ? (
            <span data-testid="status-strip-working" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--ed-fg-1)", fontWeight: 600 }}>
              <GoblinLogo state="working" size={15} variant="gold" />
              {t(lang, "Goblin arbeitet", "Goblin is working")}… {workingSeconds}s
            </span>
          ) : state === "empty" ? (
            <span style={{ color: "var(--ed-fg-3)" }}>{t(lang, "Noch keine Dateien", "No files yet")}</span>
          ) : draftCount > 0 ? (
            <>
              <span style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid var(--ed-draft)", flexShrink: 0 }} />
              <span style={{ color: "var(--ed-fg-2)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t(lang, "Nicht veröffentlichte Änderungen", "Unpublished changes")} · {draftCount} {draftCount === 1 ? t(lang, "Datei", "file") : t(lang, "Dateien", "files")}
              </span>
            </>
          ) : state === "deployed" && liveUrl ? (
            <>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6db97b", flexShrink: 0 }} />
              <a
                href={liveUrl} target="_blank" rel="noopener noreferrer" title={liveUrl}
                style={{ color: "var(--ed-accent)", fontFamily: "JetBrains Mono, monospace", fontSize: 12, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
              >
                {t(lang, "Live", "Live")} · {liveUrl.replace(/^https?:\/\//, "")}
              </a>
            </>
          ) : (
            // Saved but never deployed — do NOT claim "Live".
            <span style={{ color: "var(--ed-fg-3)" }}>{t(lang, "Gesichert · bereit zum Veröffentlichen", "Saved · ready to publish")}</span>
          )}
        </span>
        {state === "deployed" && liveUrl && lastDeployedRel && (
          <span style={{ fontSize: 11, color: "var(--ed-fg-3)", fontFamily: "var(--font-sans)", flexShrink: 0 }}>
            {t(lang, "aktualisiert", "updated")} {lastDeployedRel}
          </span>
        )}
      </div>
      {jit && <div data-testid="status-strip-jit">{jit}</div>}
    </div>
  );
}
