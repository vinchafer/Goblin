'use client';
// LEGACY — superseded by SettingsRoot + SettingsModal. Direct-URL
// access only. Do not extend; future settings additions belong in
// SettingsRoot (apps/web/components/settings/SettingsRoot.tsx)
// and components/settings/sections.ts.
import { useState } from 'react';
import { detectHardware, getModelRecommendations, isLocalModeAvailable, type HardwareInfo, type ModelRecommendation } from '@/lib/hardware-check';
import { SettingsLayout } from '@/components/settings/settings-layout';

const tagColors: Record<string, string> = {
  recommended: 'var(--brand-gold)',
  fast: 'var(--success)',
  capable: '#3A6B8A',
  powerful: '#7B3A8A',
};

function ModelCard({ model, onCopy }: { model: ModelRecommendation; onCopy: (cmd: string) => void }) {
  const color = tagColors[model.tag] ?? '#888';
  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            {model.name}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.5px',
            padding: '1px 6px', borderRadius: 4,
            background: `${color}22`, color,
            fontFamily: 'var(--font-sans)',
            textTransform: 'uppercase',
          }}>
            {model.tag}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--meta)', fontFamily: 'var(--font-mono)' }}>
          {model.pullCommand}
        </div>
      </div>
      <button
        onClick={() => onCopy(model.pullCommand)}
        style={{
          flexShrink: 0,
          padding: '6px 12px',
          background: 'var(--brand-green)',
          color: '#fff',
          border: 'none',
          borderRadius: 7,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#3a5f38')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--brand-green)')}
      >
        Copy
      </button>
    </div>
  );
}

export default function LocalSettingsPage() {
  const [hw, setHw] = useState<HardwareInfo | null>(null);
  const [models, setModels] = useState<ModelRecommendation[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const canLocal = isLocalModeAvailable();

  const runCheck = () => {
    const info = detectHardware();
    setHw(info);
    setModels(getModelRecommendations(info));
    setChecked(true);
  };

  const copyToClipboard = (cmd: string) => {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(cmd);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <SettingsLayout>
    <div style={{ maxWidth: 640 }}>
      <h1 style={{
        fontSize: 22, fontWeight: 700,
        color: 'var(--text)', fontFamily: 'var(--font-sans)',
        marginBottom: 6,
      }}>
        Local Mode
      </h1>
      <p style={{ fontSize: 13, color: 'var(--meta)', fontFamily: 'var(--font-sans)', marginBottom: 28, lineHeight: 1.6 }}>
        Run AI models on your own hardware for free — no API keys, no usage limits. Requires the Goblin Desktop App and Ollama installed locally.
      </p>

      {!canLocal && (
        <div style={{
          background: 'rgba(212,169,74,0.06)',
          border: '1px solid rgba(212,169,74,0.2)',
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 24,
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🖥</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', marginBottom: 4 }}>
              Desktop App required
            </div>
            <div style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
              Local mode only works in the Goblin Desktop App (Tauri). Your browser can&apos;t connect to localhost Ollama for security reasons.
            </div>
            <a
              href="https://justgoblin.com/download"
              style={{
                display: 'inline-block', marginTop: 8,
                fontSize: 'var(--t-caption-fs)', color: 'var(--brand-green)', fontWeight: 600,
                fontFamily: 'var(--font-sans)', textDecoration: 'none',
              }}
            >
              Download Goblin Desktop →
            </a>
          </div>
        </div>
      )}

      {/* Hardware Check */}
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '20px',
        marginBottom: 24,
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', marginBottom: 4 }}>
          Hardware Check
        </h2>
        <p style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>
          Detects your RAM and GPU to recommend which models will run smoothly.
        </p>

        {!checked ? (
          <button
            onClick={runCheck}
            style={{
              padding: '9px 18px',
              background: 'var(--brand-green)', color: '#fff',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#3a5f38')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--brand-green)')}
          >
            Check My Hardware
          </button>
        ) : hw && (
          <div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
              <HwBadge label="RAM" value={hw.ramGB !== null ? `${hw.ramGB}GB${!hw.isTauri ? '*' : ''}` : 'Unknown'} />
              <HwBadge label="CPU Cores" value={hw.cpuCores?.toString() ?? 'Unknown'} />
              {hw.gpuName && <HwBadge label="GPU" value={hw.gpuName.replace(/\(.*\)/, '').trim()} />}
            </div>
            {!hw.isTauri && (
              <p style={{ fontSize: 11, color: 'var(--disabled)', fontFamily: 'var(--font-sans)', marginTop: 8 }}>
                * RAM estimate from browser (capped at 8GB). Desktop App shows exact values.
              </p>
            )}
            <button
              onClick={runCheck}
              style={{
                marginTop: 12, padding: '6px 12px',
                background: 'none', color: 'var(--meta)',
                border: '1px solid var(--border)', borderRadius: 6,
                fontSize: 11, fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
              }}
            >
              Re-check
            </button>
          </div>
        )}
      </div>

      {/* Model Recommendations */}
      {checked && (
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', marginBottom: 4 }}>
            Recommended Models
          </h2>
          <p style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', fontFamily: 'var(--font-sans)', marginBottom: 14 }}>
            Click Copy to get the Ollama install command. Run it in your terminal.
          </p>

          {models.length === 0 ? (
            <div style={{
              background: 'rgba(212,169,74,0.06)', border: '1px solid rgba(212,169,74,0.2)',
              borderRadius: 10, padding: '16px', fontSize: 13, color: 'var(--meta)',
              fontFamily: 'var(--font-sans)',
            }}>
              Your device has less than 2GB available RAM. Consider using Cloud mode for AI inference.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {models.map(m => (
                <ModelCard
                  key={m.slug}
                  model={m}
                  onCopy={copyToClipboard}
                />
              ))}
            </div>
          )}

          {copied && (
            <div style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              background: 'var(--brand-green)', color: '#fff',
              padding: '8px 16px', borderRadius: 8,
              fontSize: 'var(--t-caption-fs)', fontFamily: 'var(--font-sans)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              zIndex: 9999,
            }}>
              Copied to clipboard!
            </div>
          )}
        </div>
      )}

      {/* Install Ollama */}
      <div style={{
        marginTop: 28,
        background: 'var(--paper)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '14px 16px',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)', marginBottom: 6 }}>
          Don&apos;t have Ollama?
        </div>
        <div style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', fontFamily: 'var(--font-sans)', marginBottom: 10, lineHeight: 1.5 }}>
          Ollama runs large language models locally on your computer. Free, open source.
        </div>
        <a
          href="https://ollama.com/download"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            padding: '7px 14px',
            background: 'var(--brand-green)', color: '#fff',
            borderRadius: 7, fontSize: 'var(--t-caption-fs)', fontWeight: 600,
            fontFamily: 'var(--font-sans)', textDecoration: 'none',
          }}
        >
          Download Ollama →
        </a>
      </div>
    </div>
    </SettingsLayout>
  );
}

function HwBadge({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'var(--paper)', border: '1px solid var(--border)',
      borderRadius: 7, padding: '6px 12px',
      display: 'flex', flexDirection: 'column', gap: 2,
      minWidth: 80,
    }}>
      <span style={{ fontSize: 10, color: 'var(--disabled)', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
        {value}
      </span>
    </div>
  );
}
