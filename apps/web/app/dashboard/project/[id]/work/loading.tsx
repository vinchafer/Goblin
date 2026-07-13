// CW-5 (Speed & Haptik): work-surface (editor) skeleton. force-dynamic route,
// heavy client editor (CodeMirror, ssr:false) mounts on entry — paint an
// editor-shaped skeleton (thread rail + code lines) instead of the project-list
// skeleton.
export default function ProjectWorkLoading() {
  return (
    <div style={{ height: '100%', display: 'flex', background: 'var(--surface-page)' }}>
      {/* Thread / file rail */}
      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--div)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[3, 5, 4, 6, 3].map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="skeleton" style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0 }} />
            <div className="skeleton" style={{ height: 11, borderRadius: 4, width: `${45 + i * 9}%` }} />
          </div>
        ))}
      </div>
      {/* Editor */}
      <div style={{ flex: 1, minWidth: 0, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {['40%', '68%', '55%', '80%', '30%', '62%', '48%', '74%', '36%', '58%'].map((w, i) => (
          <div key={i} style={{ display: 'flex', gap: 12 }}>
            <div className="skeleton" style={{ width: 16, height: 10, borderRadius: 3, flexShrink: 0, opacity: 0.6 }} />
            <div className="skeleton" style={{ width: w, height: 10, borderRadius: 3 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
