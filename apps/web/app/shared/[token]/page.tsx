interface SharedPageProps {
  params: Promise<{ token: string }>;
}

interface Msg {
  role: string;
  content: string;
  created_at: string;
}

export const dynamic = 'force-dynamic';

export default async function SharedChatPage({ params }: SharedPageProps) {
  const { token } = await params;
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

  let payload: { session: { title: string | null; created_at: string }; messages: Msg[] } | null = null;
  try {
    const res = await fetch(`${apiBase}/api/shared/${token}`, { cache: 'no-store' });
    if (res.ok) payload = await res.json();
  } catch {
    /* fall through */
  }

  if (!payload) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: 'var(--cream)',
          fontFamily: 'var(--font-ui)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: 32, margin: '0 0 12px', color: 'var(--text)' }}>
            Chat nicht gefunden
          </h1>
          <p style={{ color: 'var(--meta)' }}>
            Der Link ist ungültig oder der Chat wurde nicht mehr geteilt.
          </p>
        </div>
      </main>
    );
  }

  const { session, messages } = payload;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--cream)',
        fontFamily: 'var(--font-ui)',
        padding: '32px 16px 64px',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: 28, margin: '0 0 4px', color: 'var(--text)' }}>
          {session.title ?? 'Geteilter Chat'}
        </h1>
        <p style={{ color: 'var(--meta)', fontSize: 13, margin: '0 0 24px' }}>
          Geteilt via Goblin · {new Date(session.created_at).toLocaleDateString('de-DE')}
        </p>

        {messages.length === 0 && (
          <p style={{ color: 'var(--meta)' }}>Dieser Chat hat noch keine Nachrichten.</p>
        )}

        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={i}
              style={{
                margin: '0 0 16px',
                padding: '12px 16px',
                background: isUser ? 'var(--moss)' : 'var(--panel)',
                color: isUser ? '#fff' : 'var(--text)',
                borderRadius: 12,
                border: isUser ? 'none' : '1px solid var(--div)',
                whiteSpace: 'pre-wrap',
                fontSize: 15,
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6, textTransform: 'uppercase' }}>
                {m.role}
              </div>
              <div>{m.content}</div>
            </div>
          );
        })}

        <footer style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--div)', textAlign: 'center' }}>
          <a
            href="https://justgoblin.com"
            style={{
              color: 'var(--moss)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 15,
              fontFamily: 'var(--font-ui)',
            }}
          >
            Baue deine eigene App mit Goblin →
          </a>
        </footer>
      </div>
    </main>
  );
}
