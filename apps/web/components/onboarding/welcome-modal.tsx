"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface WelcomeModalProps {
  userName?: string;
  onComplete: () => void;
}

const STEPS = [
  { id: 'model', title: 'Connect a model', emoji: '🤖' },
  { id: 'project', title: 'Create your first project', emoji: '⚡' },
  { id: 'build', title: 'Start building', emoji: '🚀' },
];

const PROVIDERS = [
  { id: 'google', label: 'Google AI Studio', model: 'Gemini 2.0 Flash', free: true, url: 'https://aistudio.google.com/app/apikey' },
  { id: 'anthropic', label: 'Anthropic', model: 'Claude Sonnet 4.6', url: 'https://console.anthropic.com/settings/keys' },
  { id: 'groq', label: 'Groq', model: 'Llama 3.3 70B', free: true, url: 'https://console.groq.com/keys' },
  { id: 'openai', label: 'OpenAI', model: 'GPT-4o', url: 'https://platform.openai.com/api-keys' },
];

export function WelcomeModal({ userName, onComplete }: WelcomeModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else finish();
  };

  const finish = () => {
    onComplete();
    if (projectName) {
      // Will redirect after project creation
    } else {
      router.push('/dashboard');
    }
  };

  const handleSaveKey = async () => {
    if (!selectedProvider || !apiKey.trim()) return next();
    setSaving(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/byok-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selectedProvider, key: apiKey.trim() }),
      });
      if (res.ok) next();
    } catch {
      next(); // Non-blocking
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: 'var(--cream)', borderRadius: 20,
        width: '100%', maxWidth: 520,
        boxShadow: '0 32px 80px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ background: 'var(--moss)', padding: '28px 32px 24px' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>{STEPS[step]!.emoji}</div>
          <h2 style={{
            fontFamily: 'Fraunces, serif', fontSize: 26,
            color: 'var(--ochre)', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 4,
          }}>
            {step === 0 ? `Welcome to Goblin${userName ? `, ${userName.split(' ')[0]}` : ''}!` : STEPS[step]!.title}
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontFamily: 'DM Sans, sans-serif' }}>
            {step === 0 && 'Your cloud workshop is ready. Let\'s get you set up in 2 minutes.'}
            {step === 1 && 'Name your first project. You can always change this later.'}
            {step === 2 && 'You\'re all set. Chat with your goblin to start building.'}
          </p>

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 6, marginTop: 20 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                height: 3, borderRadius: 2,
                background: i <= step ? 'var(--ochre)' : 'rgba(255,255,255,0.2)',
                flex: i === step ? 2 : 1,
                transition: 'all 0.3s',
              }} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 32px' }}>

          {/* Step 0 — Connect model */}
          {step === 0 && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 16, fontFamily: 'DM Sans, sans-serif' }}>
                Choose a provider. Free options marked with ✦
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProvider(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', borderRadius: 10,
                      border: selectedProvider === p.id ? '2px solid var(--moss)' : '1.5px solid var(--div)',
                      background: selectedProvider === p.id ? 'rgba(45,74,43,0.06)' : '#fff',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif' }}>
                        {p.label}
                        {p.free && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--success)', background: 'rgba(74,124,59,0.1)', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>✦ FREE</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>{p.model}</div>
                    </div>
                    {selectedProvider === p.id && (
                      <span style={{ color: 'var(--moss)', fontSize: 16 }}>✓</span>
                    )}
                  </button>
                ))}
              </div>

              {selectedProvider && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', fontFamily: 'DM Sans, sans-serif' }}>
                      API Key
                    </label>
                    <a
                      href={PROVIDERS.find(p => p.id === selectedProvider)?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, color: 'var(--ochre-dark)', textDecoration: 'none' }}
                    >
                      Get key →
                    </a>
                  </div>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 8,
                      border: '1.5px solid var(--div)', background: '#fff',
                      fontSize: 13, fontFamily: 'JetBrains Mono, monospace',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--div)')}
                  />
                  <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 5, fontFamily: 'DM Sans, sans-serif' }}>
                    Encrypted with AES-256-GCM. Never logged.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 1 — Create project */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6, fontFamily: 'DM Sans, sans-serif' }}>
                  Project name *
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="My awesome app"
                  autoFocus
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 8,
                    border: '1.5px solid var(--div)', background: '#fff',
                    fontSize: 14, fontFamily: 'DM Sans, sans-serif',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--div)')}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6, fontFamily: 'DM Sans, sans-serif' }}>
                  What are you building? (optional)
                </label>
                <textarea
                  value={projectDesc}
                  onChange={e => setProjectDesc(e.target.value)}
                  placeholder="A todo app with dark mode..."
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 8,
                    border: '1.5px solid var(--div)', background: '#fff',
                    fontSize: 13, fontFamily: 'DM Sans, sans-serif',
                    outline: 'none', resize: 'none', boxSizing: 'border-box',
                    lineHeight: 1.5,
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--div)')}
                />
              </div>
            </div>
          )}

          {/* Step 2 — Done */}
          {step === 2 && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16, lineHeight: 1 }}>👺</div>
              <p style={{ fontSize: 15, color: 'var(--text-2)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.65, marginBottom: 8 }}>
                Your goblin is ready to build.
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-faint)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6 }}>
                Describe what you want to build. Tap [Send to Code →] to apply it instantly.
              </p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28 }}>
            <button
              onClick={finish}
              style={{
                background: 'none', border: 'none', fontSize: 12,
                color: 'var(--text-faint)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                padding: '4px 0',
              }}
            >
              Skip for now
            </button>
            <button
              onClick={step === 0 && selectedProvider && apiKey ? handleSaveKey : step === 1 && !projectName ? undefined : next}
              disabled={saving || (step === 1 && !projectName)}
              style={{
                background: 'var(--moss)', color: '#fff', border: 'none',
                borderRadius: 10, padding: '12px 28px',
                fontSize: 14, fontWeight: 500, cursor: saving ? 'wait' : 'pointer',
                fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s',
                opacity: (step === 1 && !projectName) ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!saving) e.currentTarget.style.background = 'var(--moss-2)'; }}
              onMouseLeave={e => { if (!saving) e.currentTarget.style.background = 'var(--moss)'; }}
            >
              {saving ? 'Saving…' : step === 2 ? 'Start building →' : 'Continue →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
