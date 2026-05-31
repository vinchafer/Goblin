'use client';
import { useTheme } from '@/lib/theme';

type ThemeOption = { value: 'system' | 'light' | 'dark'; label: string; icon: string };

const OPTIONS: ThemeOption[] = [
  { value: 'system', label: 'System', icon: '⚙' },
  { value: 'light',  label: 'Light',  icon: '☀' },
  { value: 'dark',   label: 'Dark',   icon: '◐' },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div style={{
      display: 'flex',
      background: 'var(--subtle)',
      borderRadius: 10,
      padding: 3,
      gap: 2,
      width: 'fit-content',
    }}>
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 8,
            border: 'none',
            background: theme === opt.value ? 'var(--panel)' : 'transparent',
            color: theme === opt.value ? 'var(--text)' : 'var(--meta)',
            fontSize: 13,
            fontWeight: theme === opt.value ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.15s',
            boxShadow: theme === opt.value ? 'var(--shadow-sm)' : 'none',
          }}
        >
          <span style={{ fontSize: 'var(--t-caption-fs)' }}>{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
