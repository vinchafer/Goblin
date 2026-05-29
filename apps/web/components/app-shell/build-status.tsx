"use client";

import { useBuildStatus } from "@/contexts/build-context";
import { GoblinLogo } from "@/components/brand/GoblinLogo";

export function BuildStatus() {
  const { isBuilding, progress, currentAction } = useBuildStatus();

  return (
    <div
      className="px-3 py-3 border-t"
      style={{ borderColor: "var(--rule-soft)" }}
    >
      <span
        className="text-[10px] font-medium uppercase tracking-widest mb-2 block"
        style={{ color: "var(--ink-3)", fontFamily: "var(--font-sans)" }}
      >
        Build
      </span>

      {isBuilding ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <GoblinLogo state="working" size={16} variant="gold" />
            <span
              className="text-xs truncate"
              style={{ color: "var(--ink-2)", fontFamily: "var(--font-jetbrains-mono)" }}
            >
              {currentAction}
            </span>
          </div>
          <div className="h-1 rounded-full" style={{ backgroundColor: "var(--rule-soft)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: "var(--brand-gold)" }}
            />
          </div>
        </div>
      ) : (
        <span
          className="text-xs"
          style={{ color: "var(--ink-3)", fontFamily: "var(--font-sans)" }}
        >
          No active builds
        </span>
      )}
    </div>
  );
}
