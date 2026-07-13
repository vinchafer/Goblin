// CW-5 (Speed & Haptik): chats-list skeleton (the route is a client page that
// fetches the chat list on mount). Header + list rows instead of the wrong
// project-list skeleton from dashboard/loading.tsx.
export default function ChatsListLoading() {
  return (
    <div style={{ height: '100%', background: 'var(--surface-page)', overflowY: 'auto' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div className="skeleton" style={{ width: 110, height: 24, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 104, height: 34, borderRadius: 8 }} />
        </div>
        <div style={{ borderTop: '1px solid var(--div)' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 6px', borderBottom: '1px solid var(--div)' }}>
              <div className="skeleton" style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="skeleton" style={{ width: `${34 + (i % 4) * 12}%`, height: 14, borderRadius: 4, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: `${20 + (i % 3) * 10}%`, height: 11, borderRadius: 4 }} />
              </div>
              <div className="skeleton" style={{ width: 30, height: 11, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
