// CW-5 (Speed & Haptik): chat-thread skeleton. The route is force-dynamic
// (auth + session + messages SELECT per nav), and the only prior loading
// boundary was dashboard/loading.tsx — a PROJECT-LIST skeleton, the wrong shape
// for a chat. This paints the chat's real shape (alternating bubbles + composer)
// on the same frame the transition starts.
export default function ChatSessionLoading() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--surface-page)' }}>
      {/* Thread */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720, width: '100%', margin: '0 auto' }}>
        {[
          { me: false, w: '72%', lines: 3 },
          { me: true, w: '48%', lines: 1 },
          { me: false, w: '84%', lines: 4 },
          { me: true, w: '38%', lines: 1 },
          { me: false, w: '60%', lines: 2 },
        ].map((m, i) => (
          <div key={i} style={{ alignSelf: m.me ? 'flex-end' : 'flex-start', width: m.w, maxWidth: '85%' }}>
            <div style={{
              padding: '12px 14px', borderRadius: 12,
              background: m.me ? 'color-mix(in srgb, var(--brand-green) 8%, transparent)' : 'var(--panel)',
              border: '1px solid var(--div)', display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {Array.from({ length: m.lines }).map((_, j) => (
                <div key={j} className="skeleton" style={{ height: 11, borderRadius: 4, width: j === m.lines - 1 ? '55%' : '100%' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Composer */}
      <div style={{ flexShrink: 0, padding: '10px 16px 16px', maxWidth: 720, width: '100%', margin: '0 auto' }}>
        <div className="skeleton" style={{ height: 52, borderRadius: 14 }} />
      </div>
    </div>
  );
}
