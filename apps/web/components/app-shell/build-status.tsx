"use client";

import { Loader2 } from "lucide-react";
import { useBuildStatus } from "@/contexts/build-context";

export function BuildStatus() {
  const { isBuilding, progress, currentAction } = useBuildStatus();

  return (
    <div
      className="px-3 py-3 border-t"
      style={{ borderColor: "var(--goblin-border)" }}
    >
      <span
        className="text-[10px] font-medium uppercase tracking-widest mb-2 block"
        style={{ color: "var(--goblin-meta)", fontFamily: "var(--font-dm-sans)" }}
      >
        Build
      </span>

      {isBuilding ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: "var(--goblin-ochre)" }} />
            <span
              className="text-xs truncate"
              style={{ color: "var(--goblin-bark)", fontFamily: "var(--font-jetbrains-mono)" }}
            >
              {currentAction}
            </span>
          </div>
          <div className="h-1 rounded-full" style={{ backgroundColor: "var(--goblin-border)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: "var(--goblin-ochre)" }}
            />
          </div>
        </div>
      ) : (
        <span
          className="text-xs"
          style={{ color: "var(--goblin-meta)", fontFamily: "var(--font-dm-sans)" }}
        >
          No active builds
        </span>
      )}
    </div>
  );
}
