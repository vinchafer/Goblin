import Link from "next/link";

export interface RecentSessionItem {
  id: string;
  name: string;
  ago: string;
}

/** Hub "Letzte Code-Sessions" card — recent code sessions in this project,
 *  newest first. Server component: click opens the Code Tab. */
export function RecentSessionsCard({ items, projectId }: { items: RecentSessionItem[]; projectId: string }) {
  return (
    <div className="gobl-panel" style={{ overflow: "hidden", alignSelf: "start" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontFamily: "var(--font-dash-display), Manrope, sans-serif", fontWeight: 600, fontSize: 15, color: "var(--ink-1)", margin: 0 }}>
          Letzte Code-Sessions
        </h2>
        {items.length > 0 && (
          <Link href={`/dashboard/project/${projectId}/work?tab=code`} style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-3)", textDecoration: "none" }}>
            Alle Sessions →
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <div style={{ padding: "20px 18px", fontSize: 13.5, color: "var(--ink-3)", display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
          <span>Noch keine Sessions.</span>
          <Link href={`/dashboard/project/${projectId}/work?tab=code`} className="gobl-btn primary">Code öffnen →</Link>
        </div>
      ) : (
        items.map((s, i) => (
          <Link key={s.id} href={`/dashboard/project/${projectId}/work?tab=code&session=${s.id}`} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", textDecoration: "none",
            borderBottom: i === items.length - 1 ? "none" : "1px solid var(--line)",
          }}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--gold)", color: "var(--green)", fontFamily: "var(--font-dash-display), Manrope, sans-serif", fontWeight: 700, fontSize: 12 }}>{"</>"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-dash-display), Manrope, sans-serif", fontWeight: 600, fontSize: 13.5, color: "var(--ink-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.name}
              </div>
            </div>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.04em", flexShrink: 0 }}>
              {s.ago}
            </span>
          </Link>
        ))
      )}
    </div>
  );
}
