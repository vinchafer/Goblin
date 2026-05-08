import { Icons } from '@/components/ui/icons';

const OPTIONS = [
  {
    Icon: Icons.Cloud,
    title: 'Goblin Hosted',
    description: 'Our GPUs. Fair-use unlimited. Always on.',
  },
  {
    Icon: Icons.Gift,
    title: 'Free-API Pool',
    description: 'Gemini, Groq when available. Gratis extra.',
  },
  {
    Icon: Icons.Lock,
    title: 'Bring Your Own Key',
    description: 'Your Claude, your OpenAI. No markup.',
  },
];

export function ModelRoutingExplainer() {
  return (
    <section style={{ background: 'var(--cream2)', padding: '96px 40px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <h2 style={{
          fontFamily: 'Fraunces, serif', fontWeight: 700, textAlign: 'center',
          fontSize: 'clamp(24px, 4vw, 40px)', color: 'var(--moss)',
          letterSpacing: '-1.5px', marginBottom: 12,
        }}>
          Three ways your goblin stays fed.
        </h2>
        <p style={{
          textAlign: 'center', fontSize: 14, color: 'var(--meta)',
          fontFamily: 'DM Sans, sans-serif', fontWeight: 300, marginBottom: 56,
        }}>
          Your goblin switches automatically. You never hit a wall.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {OPTIONS.map((option) => (
            <div key={option.title} style={{
              padding: '28px 24px', borderRadius: 12, border: '1px solid var(--border)',
              background: '#fff', textAlign: 'center',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, background: 'rgba(30,58,28,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 18px', color: 'var(--moss)',
              }}>
                <option.Icon size={20} strokeWidth={1.5} />
              </div>
              <h3 style={{
                fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 15,
                color: 'var(--bark)', marginBottom: 8,
              }}>
                {option.title}
              </h3>
              <p style={{
                fontSize: 13, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif',
                fontWeight: 300, lineHeight: 1.6,
              }}>
                {option.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
