'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoblinLogo } from '@/components/brand/GoblinLogo';
import { getAuthHeaders, API_URL } from '@/lib/api';

export default function WelcomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_URL}/api/byok-keys/has-any`, { headers, credentials: 'include' });
        if (!cancelled && res.ok) {
          const body = await res.json();
          if (body?.exists) {
            router.replace('/dashboard');
            return;
          }
        }
      } catch {
        /* fall through to welcome screen */
      }
      if (!cancelled) setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (checking) {
    return (
      <main style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--goblin-cream)',
      }}>
        <GoblinLogo state="working" size={48} variant="moss" />
      </main>
    );
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
      backgroundColor: 'var(--goblin-cream)',
      color: 'var(--goblin-green)',
    }}>
      <div style={{ maxWidth: 560, textAlign: 'center', marginBottom: 'var(--space-12)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-6)' }}>
          <GoblinLogo state="idle" size={64} variant="moss" />
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(40px, 6vw, 56px)',
          lineHeight: 1.02,
          letterSpacing: '-0.03em',
          marginBottom: 'var(--space-4)',
          fontWeight: 400,
        }}>
          Willkommen bei Goblin.
        </h1>

        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-body-l)',
          lineHeight: 1.5,
          color: 'var(--ink-muted)',
          marginBottom: 'var(--space-8)',
        }}>
          Bevor wir loslegen, brauchst du einen API-Key bei einem AI-Provider.
          Damit zahlst du nur was du nutzt — und behältst die Kontrolle.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 'var(--space-4)',
        maxWidth: 640,
        width: '100%',
      }}>
        <PathCard
          variant="light"
          icon={<GoblinLogo state="idle" size={28} variant="moss" />}
          title="Ich habe schon einen Key"
          body="Wenn du bereits einen API-Key bei Anthropic, OpenAI, Google oder Groq hast, trag ihn direkt ein."
          onClick={() => router.push('/dashboard/settings/keys')}
        />
        <PathCard
          variant="dark"
          icon={<GoblinLogo state="idle" size={28} variant="gold" />}
          title="Zeig mir einen Free-Tier"
          body="Hol dir in 60 Sekunden einen kostenlosen Key bei Google Gemini oder Groq. Schritt für Schritt."
          onClick={() => router.push('/onboarding/choose-provider')}
        />
      </div>

      <button
        onClick={() => router.push('/dashboard')}
        style={{
          marginTop: 'var(--space-8)',
          background: 'none',
          border: 'none',
          color: 'var(--ink-muted)',
          fontSize: 'var(--text-small)',
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        Erstmal stöbern (Soft-Limits)
      </button>
    </main>
  );
}

function PathCard({
  variant,
  icon,
  title,
  body,
  onClick,
}: {
  variant: 'light' | 'dark';
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
}) {
  const isDark = variant === 'dark';
  return (
    <button
      onClick={onClick}
      style={{
        padding: 'var(--space-6)',
        backgroundColor: isDark ? 'var(--goblin-moss)' : 'var(--goblin-white)',
        color: isDark ? 'var(--goblin-cream)' : 'var(--goblin-green)',
        border: isDark ? '1px solid var(--goblin-moss)' : '1px solid var(--rule)',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'transform var(--duration-base) var(--ease-out), border-color var(--duration-base) var(--ease-out)',
        fontFamily: 'var(--font-sans)',
      }}
      onMouseEnter={(e) => {
        if (isDark) e.currentTarget.style.transform = 'translateY(-2px)';
        else e.currentTarget.style.borderColor = 'var(--goblin-moss)';
      }}
      onMouseLeave={(e) => {
        if (isDark) e.currentTarget.style.transform = 'translateY(0)';
        else e.currentTarget.style.borderColor = 'var(--rule)';
      }}
    >
      <div style={{ marginBottom: 'var(--space-2)' }}>{icon}</div>
      <h3 style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-h3)',
        fontWeight: 600,
        marginBottom: 'var(--space-2)',
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: 'var(--text-small)',
        lineHeight: 1.5,
        color: isDark ? 'rgba(247, 244, 237, 0.75)' : 'var(--ink-muted)',
      }}>
        {body}
      </p>
    </button>
  );
}
