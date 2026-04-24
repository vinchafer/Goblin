export function UsageIndicators() {
  return (
    <div className="p-4 border-t" style={{ borderColor: 'var(--goblin-light)' }}>
      <span className="text-xs font-semibold uppercase tracking-wide mb-3 block" style={{ color: 'var(--goblin-gray)' }}>
        Usage
      </span>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm" style={{ color: 'var(--goblin-slate)' }}>Qwen Coder</span>
            <span className="text-xs" style={{ color: 'var(--goblin-moss)' }}>Fair-use unlimited</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--goblin-light)' }}>
            <div className="h-full rounded-full w-full" style={{ backgroundColor: 'var(--goblin-moss)' }} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm" style={{ color: 'var(--goblin-slate)' }}>Free API Pool</span>
            <span className="text-xs" style={{ color: 'var(--goblin-ochre)' }}>32% remaining today</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--goblin-light)' }}>
            <div className="h-full rounded-full" style={{ width: '68%', backgroundColor: 'var(--goblin-ochre)' }} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm" style={{ color: 'var(--goblin-slate)' }}>Claude (BYOK)</span>
            <span className="text-xs" style={{ color: 'var(--goblin-moss)' }}>Connected</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--goblin-light)' }}>
            <div className="h-full rounded-full w-full" style={{ backgroundColor: 'var(--goblin-moss)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}