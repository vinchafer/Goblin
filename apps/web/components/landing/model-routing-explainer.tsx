import { Icons } from '@/components/ui/icons';

const OPTIONS = [
  {
    Icon: Icons.Lock,
    title: 'Bring Your Own Key',
    description: 'Connect your Claude, OpenAI, Google, Groq key. No markup — you pay the provider directly.',
    badge: null,
  },
  {
    Icon: Icons.Gift,
    title: 'Free Provider Tiers',
    description: 'Groq, Google AI Studio, and OpenRouter offer generous free tiers. Connect your own account in one click.',
    badge: null,
  },
  {
    Icon: Icons.Cloud,
    title: 'Goblin Hosted',
    description: 'Open-source models (Qwen Coder 14B, Llama 3.3 70B) hosted by us. No key needed — included in your plan.',
    badge: 'Coming Soon',
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
          Your AI, your choice.
        </h2>
        <p style={{
          textAlign: 'center', fontSize: 14, color: 'var(--meta)',
          fontFamily: 'DM Sans, sans-serif', fontWeight: 300, marginBottom: 56,
        }}>
          Use any provider. No vendor lock-in. Ever.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {OPTIONS.map((option) => (
            <div key={option.title} style={{
              padding: '28px 24px', borderRadius: 12, border: '1px solid var(--border)',
              background: '#fff', textAlign: 'center', position: 'relative',
              opacity: option.badge ? 0.75 : 1,
            }}>
              {option.badge && (
                <div style={{
                  position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(212,169,74,0.9)', color: '#fff', fontSize: 10,
                  fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                  fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.05em',
                  textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const,
                }}>
                  {option.badge}
                </div>
              )}
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
