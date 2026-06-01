"use client";

import { useState } from "react";

export interface DeployUrlItem {
  url: string;
  ago: string;
  live: boolean; // the most recent (current) deploy
}

/** Hub "URLs" card body — lists every live URL for the project with a copy
 *  button + relative timestamp. Client component only for the clipboard action;
 *  data is fetched + time-formatted on the server. */
export function DeployUrlList({ items }: { items: DeployUrlItem[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (url: string) => {
    navigator.clipboard?.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied((c) => (c === url ? null : c)), 1600);
  };

  if (items.length === 0) {
    return <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Noch nicht deployed.</span>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it, i) => (
        <div key={it.url + i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a
            href={it.url}
            target="_blank"
            rel="noopener noreferrer"
            title={it.url}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0,
              background: it.live ? "var(--ok-soft)" : "var(--d-surface-elev)",
              border: it.live ? "1px solid rgba(47,106,71,.30)" : "1px solid var(--line)",
              color: it.live ? "var(--ok)" : "var(--ink-1)", borderRadius: 999,
              padding: "7px 14px", fontFamily: "JetBrains Mono, monospace", fontSize: 11.5,
              textDecoration: "none", overflow: "hidden",
            }}
          >
            <span style={{ flexShrink: 0 }}>🌐</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {it.url.replace(/^https?:\/\//, "")}
            </span>
            <span style={{ flexShrink: 0, opacity: 0.7 }}>· {it.live ? "LIVE" : it.ago}</span>
          </a>
          <button
            onClick={() => copy(it.url)}
            title="URL kopieren"
            aria-label="URL kopieren"
            style={{
              flexShrink: 0, background: "transparent", border: "1px solid var(--line)",
              color: "var(--ink-2)", borderRadius: 8, padding: "6px 9px", fontSize: 11,
              cursor: "pointer", fontFamily: "var(--font-sans)",
            }}
          >
            {copied === it.url ? "Kopiert" : "Kopieren"}
          </button>
        </div>
      ))}
    </div>
  );
}
