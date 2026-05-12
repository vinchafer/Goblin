'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders, API_URL } from '@/lib/api';

interface Alternative {
  id: string;
  label: string;
}

interface RecommendationData {
  type: 'recommendation';
  category: 'ai_provider' | 'code_hosting' | 'deploy_target';
  recommended: {
    id: string;
    label: string;
    reason: string;
    deeplink: string | null;
  };
  alternatives: Alternative[];
}

const CATEGORY_LABELS: Record<string, string> = {
  ai_provider: 'AI Provider',
  code_hosting: 'Code Hosting',
  deploy_target: 'Deploy Target',
};

interface RecommendationCardProps {
  data: RecommendationData;
  onConfirm?: (category: string, choice: string) => void;
}

export function RecommendationCard({ data, onConfirm }: RecommendationCardProps) {
  const router = useRouter();
  const [showAlts, setShowAlts] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async (choiceId: string) => {
    setConfirming(true);
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/api/onboarding-agent/confirm`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ category: data.category, choice: choiceId }),
      });
      setConfirmed(true);
      onConfirm?.(data.category, choiceId);
    } finally {
      setConfirming(false);
    }
  };

  const handleAction = async (id: string, deeplink: string | null) => {
    await handleConfirm(id);
    if (deeplink) {
      if (deeplink.startsWith('/api/')) {
        window.location.href = deeplink;
      } else {
        router.push(deeplink);
      }
    }
  };

  if (confirmed) {
    return (
      <div style={{
        background: 'rgba(74,124,59,0.08)',
        border: '1px solid rgba(74,124,59,0.25)',
        borderRadius: 10, padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ color: 'var(--success)', fontSize: 14 }}>✓</span>
        <span style={{ fontSize: 12, color: 'var(--success)', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>
          {CATEGORY_LABELS[data.category]}: {data.recommended.label}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      background: '#fff',
      border: '1.5px solid #E8E4DC',
      borderRadius: 12,
      padding: '14px 16px',
      maxWidth: 360,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.8px',
        color: 'var(--disabled)', textTransform: 'uppercase',
        fontFamily: 'DM Sans, sans-serif', marginBottom: 8,
      }}>
        {CATEGORY_LABELS[data.category]}
      </div>

      {/* Recommended option */}
      <div style={{
        background: 'rgba(45,74,43,0.04)',
        border: '2px solid #2D4A2B',
        borderRadius: 9, padding: '10px 12px', marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--moss)', fontFamily: 'DM Sans, sans-serif' }}>
            {data.recommended.label}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
            background: 'rgba(45,74,43,0.1)', color: 'var(--moss)',
            fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            Recommended
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5, marginBottom: 10 }}>
          {data.recommended.reason}
        </div>
        <button
          onClick={() => handleAction(data.recommended.id, data.recommended.deeplink)}
          disabled={confirming}
          style={{
            width: '100%', padding: '7px',
            background: 'var(--moss)', color: 'var(--ochre)',
            border: 'none', borderRadius: 7,
            fontSize: 12, fontWeight: 700,
            cursor: confirming ? 'not-allowed' : 'pointer',
            fontFamily: 'DM Sans, sans-serif',
            opacity: confirming ? 0.7 : 1,
          }}
        >
          {confirming ? '...' : data.recommended.deeplink ? `Set up ${data.recommended.label} →` : `Choose ${data.recommended.label}`}
        </button>
      </div>

      {/* Alternatives toggle */}
      {data.alternatives.length > 0 && (
        <>
          <button
            onClick={() => setShowAlts(a => !a)}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: 11, color: 'var(--disabled)', cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif', textDecoration: 'underline',
              textDecorationColor: 'rgba(0,0,0,0.15)',
            }}
          >
            {showAlts ? 'Hide alternatives' : `Or choose something else (${data.alternatives.length} options)`}
          </button>

          {showAlts && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.alternatives.map(alt => (
                <button
                  key={alt.id}
                  onClick={() => handleAction(alt.id, null)}
                  disabled={confirming}
                  style={{
                    padding: '7px 10px', background: 'transparent',
                    border: '1px solid #E8E4DC', borderRadius: 7,
                    fontSize: 12, color: 'var(--text)', cursor: 'pointer',
                    fontFamily: 'DM Sans, sans-serif', textAlign: 'left',
                    transition: 'border-color 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--moss)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--div)')}
                >
                  {alt.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface SetupCompleteData {
  type: 'setup_complete';
  summary: Record<string, string>;
}

export function SetupCompleteCard({ data }: { data: SetupCompleteData }) {
  const router = useRouter();
  const labels: Record<string, string> = {
    ai_provider: 'AI Provider',
    code_hosting: 'Code Hosting',
    deploy_target: 'Deploy Target',
  };
  return (
    <div style={{
      background: 'rgba(74,124,59,0.06)',
      border: '1.5px solid rgba(74,124,59,0.3)',
      borderRadius: 12, padding: '16px',
      maxWidth: 360,
    }}>
      <div style={{ fontSize: 16, marginBottom: 10 }}>🎉</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--moss)', fontFamily: 'DM Sans, sans-serif', marginBottom: 8 }}>
        Setup complete!
      </div>
      {Object.entries(data.summary).map(([key, val]) => (
        <div key={key} style={{ fontSize: 12, color: 'var(--success)', fontFamily: 'DM Sans, sans-serif', marginBottom: 3 }}>
          ✓ {labels[key] ?? key}: {val}
        </div>
      ))}
      <button
        onClick={() => router.push('/dashboard')}
        style={{
          display: 'block', width: '100%', marginTop: 14,
          padding: '9px', background: 'var(--moss)', color: 'var(--ochre)',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
        }}
      >
        Start building →
      </button>
    </div>
  );
}
