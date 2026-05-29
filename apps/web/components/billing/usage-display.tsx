interface UsageDisplayProps {
  used: number;
  limit: number;
  resetDate: string;
}

export function UsageDisplay({ used, limit, resetDate }: UsageDisplayProps) {
  const percentage = Math.min((used / limit) * 100, 100);

  let barColor = 'var(--brand-green)';
  if (percentage > 80) barColor = 'var(--brand-gold)';
  if (percentage >= 100) barColor = 'var(--danger)';

  return (
    <div className="mb-8">
      <div className="flex justify-between mb-2">
        <div className="text-sm" style={{ color: 'var(--ink-1)' }}>
          <span className="font-semibold">{used}</span> / {limit} requests used this month
        </div>
        <div className="text-sm" style={{ color: 'var(--ink-3)' }}>
          Resets on {new Date(resetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      </div>

      <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-3)' }}>
        <div
          className="h-full transition-all duration-500 rounded-full"
          style={{ width: `${percentage}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}