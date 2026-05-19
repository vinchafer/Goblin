'use client';

import { useRouter } from 'next/navigation';

interface ProviderOption {
  slug: 'gemini' | 'groq' | 'anthropic';
  name: string;
  badge: 'free' | 'paid';
  badgeText: string;
  description: string;
  pros: string[];
  cons: string[];
  recommended?: boolean;
}

const PROVIDERS: ProviderOption[] = [
  {
    slug: 'gemini',
    name: 'Google Gemini',
    badge: 'free',
    badgeText: 'Kostenlos',
    description: 'Großzügiger Free-Tier von Google. Für die meisten Use-Cases reicht das aus.',
    pros: [
      '15 Requests/Minute kostenlos',
      '1500 Requests/Tag kostenlos',
      'Gute Coding-Qualität (Gemini 2.0 Pro)',
    ],
    cons: [
      'Google-Account nötig',
      'Daten werden zu Training verwendet (Free-Tier)',
    ],
    recommended: true,
  },
  {
    slug: 'groq',
    name: 'Groq',
    badge: 'free',
    badgeText: 'Kostenlos + schnell',
    description: 'Extrem schnelle Antworten via spezialisierter Hardware. Limitierte Modell-Auswahl.',
    pros: [
      '30 Requests/Minute kostenlos',
      'Antwortet 3-5x schneller als andere',
      'Llama 3.3 70B, Mixtral verfügbar',
    ],
    cons: [
      'Kein Claude oder GPT verfügbar',
      'Niedrigere Daily-Limits',
    ],
  },
  {
    slug: 'anthropic',
    name: 'Anthropic Claude',
    badge: 'paid',
    badgeText: 'Pay-as-you-go',
    description: 'Beste Coding-Qualität. Kein Free-Tier, aber günstig bei kleinem Volumen.',
    pros: [
      'Claude 4.5 Sonnet — beste Coding-Performance',
      'Pay-as-you-go ohne Subscription',
      '~$0.01 pro typischem Chat',
    ],
    cons: [
      'Kreditkarte nötig',
      'Kein Free-Tier',
    ],
  },
];

export default function ChooseProviderPage() {
  const router = useRouter();

  return (
    <main style={{
      minHeight: '100vh',
      padding: 'var(--space-6)',
      backgroundColor: 'var(--goblin-cream)',
      color: 'var(--goblin-green)',
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <button
          onClick={() => router.push('/welcome')}
          style={{
            background: 'none', border: 'none', padding: 0,
            color: 'var(--ink-muted)', fontSize: 'var(--text-small)',
            cursor: 'pointer', marginBottom: 'var(--space-6)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          ← Zurück
        </button>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-h2)',
          fontWeight: 400,
          letterSpacing: '-0.025em',
          marginBottom: 'var(--space-3)',
        }}>
          Wähle einen Provider
        </h1>

        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-body-l)',
          color: 'var(--ink-muted)',
          marginBottom: 'var(--space-8)',
          maxWidth: 640,
        }}>
          Wir empfehlen Google Gemini für den Anfang — großzügiger Free-Tier und solide
          Qualität. Du kannst später jederzeit weitere Provider hinzufügen.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-4)',
        }}>
          {PROVIDERS.map(p => (
            <ProviderCard
              key={p.slug}
              provider={p}
              onSelect={() => router.push(`/onboarding/${p.slug}/step-1`)}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function ProviderCard({ provider, onSelect }: { provider: ProviderOption; onSelect: () => void }) {
  const isFree = provider.badge === 'free';
  return (
    <div style={{
      padding: 'var(--space-6)',
      backgroundColor: 'var(--goblin-white)',
      border: provider.recommended ? '2px solid var(--goblin-moss)' : '1px solid var(--rule)',
      borderRadius: 'var(--radius-lg)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)',
      position: 'relative',
      fontFamily: 'var(--font-sans)',
    }}>
      {provider.recommended && (
        <div style={{
          position: 'absolute',
          top: -10,
          left: 'var(--space-4)',
          padding: '2px 10px',
          backgroundColor: 'var(--goblin-moss)',
          color: 'var(--goblin-cream)',
          fontSize: 'var(--text-label)',
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          borderRadius: 'var(--radius-sm)',
        }}>
          Empfohlen
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 'var(--text-h3)', fontWeight: 600 }}>{provider.name}</h3>
        <span style={{
          padding: '2px 8px',
          backgroundColor: isFree ? 'var(--goblin-moss)' : 'var(--ink-muted)',
          color: 'var(--goblin-cream)',
          fontSize: 'var(--text-label)',
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          borderRadius: 'var(--radius-sm)',
        }}>
          {provider.badgeText}
        </span>
      </div>

      <p style={{ fontSize: 'var(--text-small)', color: 'var(--ink-muted)', lineHeight: 1.5 }}>
        {provider.description}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        {provider.pros.map((pro, i) => (
          <div key={`pro-${i}`} style={{ fontSize: 'var(--text-small)', display: 'flex', gap: 'var(--space-2)' }}>
            <span style={{ color: 'var(--goblin-moss)' }}>+</span>
            <span>{pro}</span>
          </div>
        ))}
        {provider.cons.map((con, i) => (
          <div key={`con-${i}`} style={{ fontSize: 'var(--text-small)', display: 'flex', gap: 'var(--space-2)', color: 'var(--ink-muted)' }}>
            <span>−</span>
            <span>{con}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onSelect}
        style={{
          marginTop: 'auto',
          padding: 'var(--space-3) var(--space-4)',
          backgroundColor: provider.recommended ? 'var(--goblin-moss)' : 'transparent',
          color: provider.recommended ? 'var(--goblin-cream)' : 'var(--goblin-green)',
          border: provider.recommended ? 'none' : '1px solid var(--goblin-green)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 'var(--text-body)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Setup starten
      </button>
    </div>
  );
}
