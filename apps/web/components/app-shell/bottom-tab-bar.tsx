'use client';
import { useApp } from '@/contexts/app-context';

export function BottomTabBar() {
  const { activeTab, setActiveTab, injectionCount } = useApp();

  const tabs = [
    { id: 'chat' as const, label: 'Chat', icon: '💬' },
    { id: 'code' as const, label: 'Code', icon: '</>' },
    { id: 'preview' as const, label: 'Preview', icon: '🌐' },
  ];

  return (
    <nav style={{
      height: 56,
      background: 'var(--panel)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      zIndex: 50,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      flexShrink: 0,
    }} className="goblin-bottom-bar">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 3, fontSize: 10, fontWeight: 500, fontFamily: 'DM Sans, sans-serif',
            color: activeTab === tab.id ? 'var(--moss)' : 'var(--meta)',
            position: 'relative', minHeight: 44,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
          {tab.label}
          {tab.id === 'code' && injectionCount > 0 && (
            <span style={{ position: 'absolute', top: 8, right: '30%', width: 6, height: 6, borderRadius: '50%', background: 'var(--ochre)', animation: 'blink 1.5s infinite' }} />
          )}
        </button>
      ))}
      <style>{`
        .goblin-bottom-bar { display: none; }
        @media (max-width: 768px) { .goblin-bottom-bar { display: flex !important; } }
      `}</style>
    </nav>
  );
}
