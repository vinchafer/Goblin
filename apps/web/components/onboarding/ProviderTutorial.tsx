'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoblinLogo } from '@/components/brand/GoblinLogo';
import { getAuthHeaders, API_URL } from '@/lib/api';
import type { ByokProvider } from '@goblin/shared/src/schemas';

export interface TutorialStep {
  title: string;
  description: string;
  screenshot: string;
  cta?: { label: string; url: string };
  hint?: string;
}

export interface ProviderTutorialConfig {
  /** Provider id sent to the backend (ByokProvider). */
  provider: ByokProvider;
  /** Marketing slug used in URLs, e.g. "gemini" → /onboarding/gemini/step-1. */
  slug: string;
  /** Display name shown in step header. */
  displayName: string;
  /** Validate raw key prefix client-side before POST. */
  keyPrefix: string;
  /** Friendly placeholder for the input. */
  placeholder: string;
  /** Ordered list of steps. The final step renders the key-input form. */
  steps: TutorialStep[];
}

interface Props {
  config: ProviderTutorialConfig;
  stepKey: string;
}

export function ProviderTutorial({ config, stepKey }: Props) {
  const router = useRouter();
  const stepNum = parseInt(stepKey, 10);
  const stepCount = config.steps.length;
  const step = Number.isFinite(stepNum) ? config.steps[stepNum - 1] : undefined;

  const [apiKey, setApiKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!step) {
    return (
      <main style={{ minHeight: '100vh', padding: 'var(--space-6)', backgroundColor: 'var(--goblin-cream)', color: 'var(--goblin-green)' }}>
        <p>Step nicht gefunden.</p>
      </main>
    );
  }

  const isFinal = stepNum === stepCount;

  const handleSubmitKey = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed.startsWith(config.keyPrefix)) {
      setError(`Das sieht nicht nach einem ${config.displayName}-Key aus. Sollte mit "${config.keyPrefix}" anfangen.`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/byok-keys`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider: config.provider, key: trimmed, label: 'Onboarding' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Speichern fehlgeschlagen. Prüfe den Key.');
        setSubmitting(false);
        return;
      }
      router.push('/dashboard?welcome=1');
    } catch {
      setError('Netzwerk-Fehler. Bitte erneut versuchen.');
      setSubmitting(false);
    }
  };

  const goPrev = () => {
    if (stepNum > 1) router.push(`/onboarding/${config.slug}/step-${stepNum - 1}`);
    else router.push('/onboarding/choose-provider');
  };
  const goNext = () => router.push(`/onboarding/${config.slug}/step-${stepNum + 1}`);

  return (
    <main style={{
      minHeight: '100vh',
      padding: 'var(--space-6)',
      backgroundColor: 'var(--goblin-cream)',
      color: 'var(--goblin-green)',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <button
          onClick={goPrev}
          style={{
            background: 'none', border: 'none', padding: 0,
            color: 'var(--ink-muted)', fontSize: 'var(--text-small)',
            cursor: 'pointer', marginBottom: 'var(--space-4)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          ← Zurück
        </button>

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          {config.steps.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 4,
              backgroundColor: i + 1 <= stepNum ? 'var(--goblin-moss)' : 'var(--rule)',
              borderRadius: 'var(--radius-full)',
              transition: 'background-color var(--duration-base) var(--ease-out)',
            }} />
          ))}
        </div>

        <p style={{
          fontSize: 'var(--text-label)',
          color: 'var(--ink-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          marginBottom: 'var(--space-6)',
          fontFamily: 'var(--font-sans)',
        }}>
          Schritt {stepNum} von {stepCount} — {config.displayName} Setup
        </p>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-h2)',
          fontWeight: 400,
          letterSpacing: '-0.025em',
          marginBottom: 'var(--space-3)',
        }}>
          {step.title}
        </h1>

        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-body-l)',
          color: 'var(--ink-muted)',
          marginBottom: 'var(--space-6)',
          lineHeight: 1.5,
        }}>
          {step.description}
        </p>

        {step.screenshot && (
          <Screenshot src={step.screenshot} stepNum={stepNum} />
        )}

        {step.hint && (
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'rgba(212, 167, 55, 0.10)',
            borderLeft: '3px solid var(--goblin-gold)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 'var(--space-6)',
            fontSize: 'var(--text-small)',
            fontFamily: 'var(--font-sans)',
          }}>
            {step.hint}
          </div>
        )}

        {!isFinal && (
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {step.cta && (
              <a
                href={step.cta.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: 'var(--space-3) var(--space-5)',
                  backgroundColor: 'var(--goblin-moss)',
                  color: 'var(--goblin-cream)',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: 'var(--text-body)',
                  fontFamily: 'var(--font-sans)',
                  textDecoration: 'none',
                }}
              >
                {step.cta.label}
              </a>
            )}
            <button
              onClick={goNext}
              style={{
                padding: 'var(--space-3) var(--space-5)',
                backgroundColor: step.cta ? 'transparent' : 'var(--goblin-moss)',
                color: step.cta ? 'var(--goblin-green)' : 'var(--goblin-cream)',
                border: step.cta ? '1px solid var(--goblin-green)' : 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 'var(--text-body)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Weiter →
            </button>
          </div>
        )}

        {isFinal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config.placeholder}
              autoFocus
              style={{
                padding: 'var(--space-3)',
                fontSize: 'var(--text-body-l)',
                fontFamily: 'var(--font-mono)',
                border: '1px solid var(--rule)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--goblin-white)',
                color: 'var(--goblin-green)',
              }}
            />
            {error && (
              <p style={{ color: 'var(--rust, #B85C3C)', fontSize: 'var(--text-small)', fontFamily: 'var(--font-sans)' }}>
                {error}
              </p>
            )}
            <button
              onClick={handleSubmitKey}
              disabled={submitting || !apiKey.trim()}
              style={{
                padding: 'var(--space-3) var(--space-5)',
                backgroundColor: submitting || !apiKey.trim() ? 'var(--ink-muted)' : 'var(--goblin-moss)',
                color: 'var(--goblin-cream)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: submitting || !apiKey.trim() ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: 'var(--text-body)',
                fontFamily: 'var(--font-sans)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
              }}
            >
              {submitting && <GoblinLogo state="working" size={18} variant="gold" />}
              {submitting ? 'Speichere & teste…' : 'Key speichern & loslegen'}
            </button>
            <p style={{
              fontSize: 'var(--text-small)',
              color: 'var(--ink-muted)',
              textAlign: 'center',
              fontFamily: 'var(--font-sans)',
            }}>
              Verschlüsselt mit deinem persönlichen Key. Wir können ihn nicht lesen.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function Screenshot({ src, stepNum }: { src: string; stepNum: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <div style={{
      marginBottom: 'var(--space-6)',
      border: '1px solid var(--rule)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      backgroundColor: 'var(--goblin-white)',
    }}>
      {failed ? (
        <div style={{
          padding: 'var(--space-8)',
          textAlign: 'center',
          color: 'var(--ink-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-small)',
        }}>
          Screenshot {stepNum}: {src}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`Screenshot Schritt ${stepNum}`}
          style={{ width: '100%', display: 'block' }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
