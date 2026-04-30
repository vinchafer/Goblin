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
      background: '#ffffff',
      borderTop: '1px solid #e5e5e5',
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
            color: activeTab === tab.id ? '#D4A94A' : '#6B6B6B',
            position: 'relative', minHeight: 44,
            opacity: tab.id === 'preview' ? 0.6 : 1,
          }}
          disabled={tab.id === 'preview'}
          title={tab.id === 'preview' ? 'Deploy first to see preview' : ''}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
          {tab.label}
          {tab.id === 'code' && injectionCount > 0 && (
            <span style={{ position: 'absolute', top: 8, right: '30%', width: 6, height: 6, borderRadius: '50%', background: '#D4A94A', animation: 'blink 1.5s infinite' }} />
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
