"use client";

import { Loader2 } from "lucide-react";
import { useBuildStatus } from "@/contexts/build-context";

export function BuildStatus() {
  const { isBuilding, progress, currentAction } = useBuildStatus();

  return (
    <div className="p-4 border-t" style={{ borderColor: 'var(--goblin-light)' }}>
      <span className="text-xs font-semibold uppercase tracking-wide mb-3 block" style={{ color: 'var(--goblin-gray)' }}>
        Build Status
      </span>

      {isBuilding ? (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--goblin-ochre)' }} />
            <span className="text-sm" style={{ color: 'var(--goblin-slate)' }}>{currentAction}</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--goblin-light)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                backgroundColor: 'var(--goblin-ochre)'
              }}
            />
          </div>
        </div>
      ) : (
        <span className="text-sm" style={{ color: 'var(--goblin-gray)' }}>
          No active builds
        </span>
      )}
    </div>
  );
}