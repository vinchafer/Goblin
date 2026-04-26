"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ModelStatus {
  byok: Record<string, boolean>;
  freeApi: Record<string, { available: boolean; usedToday: number; limit: number }>;
}

interface UsageData {
  plan: "seed" | "craft" | "forge";
  monthly_requests_used: number;
  monthly_limit: number;
}

const PROVIDER_ROWS = [
  { key: "goblin", label: "Goblin Hosted", type: "hosted" },
  { key: "freeApiPool", label: "Free-API Pool", type: "free" },
  { key: "anthropic", label: "BYOK Anthropic", type: "byok" },
  { key: "openai", label: "BYOK OpenAI", type: "byok" },
] as const;

type StatusDot = "ochre" | "green" | "gray";

function Dot({ status }: { status: StatusDot }) {
  const color =
    status === "ochre"
      ? "var(--goblin-ochre)"
      : status === "green"
      ? "#22c55e"
      : "rgba(0,0,0,0.2)";
  return (
    <span
      className="w-1.5 h-1.5 rounded-full shrink-0"
      style={{ backgroundColor: color, display: "inline-block" }}
    />
  );
}

export function UsageIndicators() {
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;

        const [usageRes, statusRes] = await Promise.all([
          fetch("/api/usage", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/models/status", { headers: { Authorization: `Bearer ${token}` } })
        ]);

        if (usageRes.ok) setUsage(await usageRes.json());
        if (statusRes.ok) setModelStatus(await statusRes.json());
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [supabase]);

  const pct = usage
    ? Math.min(100, (usage.monthly_requests_used / usage.monthly_limit) * 100)
    : 0;

  const getStatus = (key: string, type: string): StatusDot => {
    if (type === "hosted") return "gray";
    if (type === "free") return "green";
    if (type === "byok") return modelStatus?.byok[key] ? "ochre" : "gray";
    return "gray";
  };

  return (
    <div
      className="px-3 py-3 border-t"
      style={{ borderColor: "var(--goblin-border)" }}
    >
      <span
        className="text-[10px] font-medium uppercase tracking-widest mb-2 block"
        style={{ color: "var(--goblin-meta)", fontFamily: "var(--font-dm-sans)" }}
      >
        Usage
      </span>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 rounded animate-pulse" style={{ backgroundColor: "var(--goblin-border)" }} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Monthly requests bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-[11px]"
                style={{ color: "var(--goblin-bark)", fontFamily: "var(--font-dm-sans)" }}
              >
                Monthly
              </span>
              <span
                className="text-[10px]"
                style={{ color: "var(--goblin-meta)", fontFamily: "var(--font-dm-sans)" }}
              >
                {usage?.monthly_requests_used ?? 0}/{usage?.monthly_limit ?? 200}
              </span>
            </div>
            <div className="h-1 rounded-full" style={{ backgroundColor: "var(--goblin-border)" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  backgroundColor: pct > 90 ? "var(--goblin-warn)" : "var(--goblin-moss)"
                }}
              />
            </div>
          </div>

          {/* Provider status dots */}
          <div className="space-y-1 pt-1">
            {PROVIDER_ROWS.map(({ key, label, type }) => (
              <div key={key} className="flex items-center gap-2">
                <Dot status={getStatus(key, type)} />
                <span
                  className="text-[11px]"
                  style={{ color: "var(--goblin-meta)", fontFamily: "var(--font-dm-sans)" }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
