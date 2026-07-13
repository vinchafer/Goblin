// CW-5 (Speed & Haptik): file-list skeleton for the project files route
// (force-dynamic). Rows of file entries instead of the wrong project-list shape.
export default function ProjectFilesLoading() {
  return (
    <div style={{ height: '100%', background: 'var(--surface-page)', overflowY: 'auto' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 20px' }}>
        <div className="skeleton" style={{ width: 120, height: 20, borderRadius: 6, marginBottom: 20 }} />
        <div style={{ borderTop: '1px solid var(--div)' }}>
          {[68, 52, 74, 46, 60, 58, 40, 66].map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 6px', borderBottom: '1px solid var(--div)' }}>
              <div className="skeleton" style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0 }} />
              <div className="skeleton" style={{ height: 13, borderRadius: 4, width: `${w}%` }} />
              <div style={{ flex: 1 }} />
              <div className="skeleton" style={{ width: 44, height: 11, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
