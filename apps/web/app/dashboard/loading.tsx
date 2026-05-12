export default function DashboardLoading() {
  return (
    <div style={{
      height: '100%', background: 'var(--cream, #F7F4ED)',
      overflowY: 'auto',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start' }}>
          {/* Left: project list skeleton */}
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div className="skeleton" style={{ width: 90, height: 22, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: 100, height: 32, borderRadius: 7 }} />
            </div>
            <div style={{ borderTop: '1px solid var(--div)' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 8px', borderBottom: '1px solid var(--div)' }}>
                  <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ width: `${30 + i * 12}%`, height: 14, borderRadius: 4, marginBottom: 5 }} />
                    <div className="skeleton" style={{ width: `${45 + i * 8}%`, height: 11, borderRadius: 4 }} />
                  </div>
                  <div className="skeleton" style={{ width: 28, height: 11, borderRadius: 4 }} />
                </div>
              ))}
            </div>
          </div>
          {/* Right: updates skeleton */}
          <div style={{ width: 260, flexShrink: 0 }}>
            <div className="skeleton" style={{ width: 80, height: 13, borderRadius: 4, marginBottom: 16 }} />
            <div style={{ borderTop: '1px solid var(--div)' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ padding: '14px 0', borderBottom: '1px solid var(--div)' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <div className="skeleton" style={{ width: 40, height: 16, borderRadius: 4 }} />
                    <div className="skeleton" style={{ width: 50, height: 11, borderRadius: 4 }} />
                  </div>
                  <div className="skeleton" style={{ width: '85%', height: 13, borderRadius: 4, marginBottom: 4 }} />
                  <div className="skeleton" style={{ width: '65%', height: 11, borderRadius: 4 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
