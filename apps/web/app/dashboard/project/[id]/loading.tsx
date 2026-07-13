// CW-5 (Speed & Haptik): project-workspace skeleton. The route is force-dynamic
// and runs several uncached queries per visit; this paints the workspace shape
// (context bar + tab row + content panel + status line) instantly instead of the
// wrong project-list skeleton from dashboard/loading.tsx. Also the destination
// the chat back button (CW-2) prefetches — together the back tap paints this on
// the same frame.
export default function ProjectWorkspaceLoading() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--surface-page)' }}>
      {/* Context bar */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--rule)' }}>
        <div className="skeleton" style={{ width: 18, height: 18, borderRadius: 5 }} />
        <div className="skeleton" style={{ width: 140, height: 16, borderRadius: 5 }} />
        <div style={{ flex: 1 }} />
        <div className="skeleton" style={{ width: 96, height: 30, borderRadius: 8 }} />
      </div>
      {/* Tab row */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 6, padding: '8px 16px', borderBottom: '1px solid var(--div)' }}>
        {[64, 56, 72].map((w, i) => (
          <div key={i} className="skeleton" style={{ width: w, height: 26, borderRadius: 7 }} />
        ))}
      </div>
      {/* Content panel */}
      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {['92%', '78%', '85%', '60%', '70%', '45%'].map((w, i) => (
          <div key={i} className="skeleton" style={{ width: w, height: 13, borderRadius: 4 }} />
        ))}
      </div>
      {/* Status line */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderTop: '1px solid var(--div)' }}>
        <div className="skeleton" style={{ width: 90, height: 12, borderRadius: 4 }} />
        <div style={{ flex: 1 }} />
        <div className="skeleton" style={{ width: 110, height: 32, borderRadius: 8 }} />
      </div>
    </div>
  );
}
