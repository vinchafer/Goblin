'use client';

interface FilterPill {
  value: string;
  label: string;
  count?: number;
}

interface FilterPillsProps {
  pills: FilterPill[];
  active: string;
  onSelect: (value: string) => void;
  testId?: string;
}

export function FilterPills({ pills, active, onSelect, testId }: FilterPillsProps) {
  return (
    <div
      data-testid={testId ?? 'filter-pills'}
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '8px 16px',
        scrollbarWidth: 'none',
      }}
    >
      {pills.map((pill) => {
        const isActive = active === pill.value;
        return (
          <button
            key={pill.value}
            onClick={() => onSelect(pill.value)}
            data-testid={`filter-pill-${pill.value}`}
            aria-pressed={isActive}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-2xl)',
              border: '1px solid var(--border-subtle)',
              background: isActive ? 'var(--brand-green)' : 'var(--panel)',
              color: isActive ? '#FFFFFF' : 'var(--text)',
              fontSize: 'var(--t-small-fs)',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              flexShrink: 0,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 36,
            }}
          >
            {pill.label}
            {pill.count !== undefined && (
              <span style={{
                fontSize: 'var(--t-caption-fs)',
                color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--text-meta)',
              }}>{pill.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
