import Link from "next/link";
import { ProjectChatLaunch } from "./ProjectChatLaunch";

export interface RecentChatItem {
  id: string;
  title: string;
  ago: string;
}

/** Hub "Letzte Chats" card — recent chat threads in this project, newest first.
 *  Server component: pure render, click opens the thread. */
export function RecentChatsCard({ items, projectId }: { items: RecentChatItem[]; projectId: string }) {
  return (
    <div className="gobl-panel" style={{ overflow: "hidden", alignSelf: "start" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontFamily: "var(--font-dash-display), Manrope, sans-serif", fontWeight: 600, fontSize: 15, color: "var(--ink-1)", margin: 0 }}>
          Letzte Chats
        </h2>
        {items.length > 0 && (
          <ProjectChatLaunch
            projectId={projectId}
            label="+ Neuer Chat"
            className=""
            style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          />
        )}
      </div>
      {items.length === 0 ? (
        <div style={{ padding: "20px 18px", fontSize: 13.5, color: "var(--ink-3)", display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
          <span>Noch keine Chats.</span>
          <ProjectChatLaunch projectId={projectId} label="Chat öffnen" className="gobl-btn primary" />
        </div>
      ) : (
        items.map((c, i) => (
          <Link key={c.id} href={`/dashboard/chat/${c.id}`} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", textDecoration: "none",
            borderBottom: i === items.length - 1 ? "none" : "1px solid var(--line)",
          }}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--green)", color: "var(--gold)", fontFamily: "var(--font-dash-display), Manrope, sans-serif", fontWeight: 700, fontSize: 11 }}>G</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-dash-display), Manrope, sans-serif", fontWeight: 600, fontSize: 13.5, color: "var(--ink-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.title}
              </div>
            </div>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.04em", flexShrink: 0 }}>
              {c.ago}
            </span>
          </Link>
        ))
      )}
    </div>
  );
}
