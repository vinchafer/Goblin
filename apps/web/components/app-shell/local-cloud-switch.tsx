'use client';
import { useState, useEffect } from 'react';
import { isLocalModeAvailable } from '@/lib/hardware-check';

type RoutingMode = 'cloud' | 'local';

const STORAGE_KEY = 'goblin_routing_mode';

export function useRoutingMode(): [RoutingMode, (m: RoutingMode) => void] {
  const [mode, setModeState] = useState<RoutingMode>('cloud');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as RoutingMode | null;
    if (stored === 'local' && isLocalModeAvailable()) {
      setModeState('local');
    }
  }, []);

  const setMode = (m: RoutingMode) => {
    if (m === 'local' && !isLocalModeAvailable()) return;
    localStorage.setItem(STORAGE_KEY, m);
    setModeState(m);
  };

  return [mode, setMode];
}

export function LocalCloudSwitch() {
  const [mode, setMode] = useRoutingMode();
  const [tooltip, setTooltip] = useState(false);
  const canLocal = isLocalModeAvailable();

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          background: 'rgba(0,0,0,0.25)',
          borderRadius: 6,
          padding: 2,
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* LOCAL button */}
        <button
          onClick={() => canLocal ? setMode('local') : setTooltip(t => !t)}
          onMouseEnter={() => !canLocal && setTooltip(true)}
          onMouseLeave={() => setTooltip(false)}
          aria-label={canLocal ? 'Switch to local mode' : 'Local mode requires Goblin Desktop App'}
          style={{
            padding: '3px 9px',
            borderRadius: 4,
            border: 'none',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
            letterSpacing: '0.5px',
            cursor: canLocal ? 'pointer' : 'default',
            background: mode === 'local' ? 'rgba(74,124,59,0.5)' : 'transparent',
            color: mode === 'local' ? '#7dba66' : canLocal ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)',
            transition: 'all 0.15s',
            opacity: canLocal ? 1 : 0.6,
          }}
        >
          LOCAL
        </button>

        {/* CLOUD button */}
        <button
          onClick={() => setMode('cloud')}
          aria-label="Switch to cloud mode"
          style={{
            padding: '3px 9px',
            borderRadius: 4,
            border: 'none',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
            letterSpacing: '0.5px',
            cursor: 'pointer',
            background: mode === 'cloud' ? 'rgba(212,169,74,0.2)' : 'transparent',
            color: mode === 'cloud' ? 'var(--brand-gold)' : 'rgba(255,255,255,0.4)',
            transition: 'all 0.15s',
          }}
        >
          CLOUD
        </button>
      </div>

      {/* Tooltip for web users trying LOCAL */}
      {tooltip && !canLocal && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--green-900)',
          border: '1px solid var(--green-700)',
          borderRadius: 8,
          padding: '8px 12px',
          width: 220,
          zIndex: 200,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 'var(--t-caption-fs)', color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-dash-display), Manrope, sans-serif', lineHeight: 1.5 }}>
            Local mode requires the <strong>Goblin Desktop App</strong>. Free, no account needed.
          </div>
          <a
            href="https://justgoblin.com/download"
            style={{
              display: 'inline-block', marginTop: 6,
              fontSize: 11, color: 'var(--brand-gold)',
              fontFamily: 'var(--font-dash-display), Manrope, sans-serif',
              textDecoration: 'none',
            }}
          >
            Download →
          </a>
          {/* Arrow */}
          <div style={{
            position: 'absolute', top: -5, left: '50%',
            width: 10, height: 10, background: 'var(--green-900)',
            border: '1px solid var(--green-700)', borderBottom: 'none', borderRight: 'none',
            transform: 'translateX(-50%) rotate(45deg)',
          }} />
        </div>
      )}
    </div>
  );
}
