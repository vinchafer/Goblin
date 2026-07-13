// CW-5 (Speed & Haptik): this route is a fast server redirect to
// /dashboard/project/[id]; the loading boundary only shows for the redirect hop.
// Match the destination's workspace shape so there's no wrong-skeleton flash.
export default function ProjectDetailRedirectLoading() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--surface-page)' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--rule)' }}>
        <div className="skeleton" style={{ width: 18, height: 18, borderRadius: 5 }} />
        <div className="skeleton" style={{ width: 140, height: 16, borderRadius: 5 }} />
      </div>
      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {['92%', '78%', '85%', '60%'].map((w, i) => (
          <div key={i} className="skeleton" style={{ width: w, height: 13, borderRadius: 4 }} />
        ))}
      </div>
    </div>
  );
}
