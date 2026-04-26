"use client";

import { useApp, type AppTab } from "@/contexts/app-context";
import { MessageSquare, Code, Eye, Server } from "lucide-react";

const TABS: { id: AppTab; label: string; icon: React.ReactNode; comingSoon?: boolean }[] = [
  { id: "chat", label: "Chat", icon: <MessageSquare className="w-5 h-5" /> },
  { id: "code", label: "Code", icon: <Code className="w-5 h-5" /> },
  { id: "preview", label: "Preview", icon: <Eye className="w-5 h-5" />, comingSoon: true },
  { id: "server", label: "Server", icon: <Server className="w-5 h-5" />, comingSoon: true }
];

export function BottomTabBar() {
  const { activeTab, setActiveTab, injectionCount } = useApp();

  return (
    <nav
      className="md:hidden h-14 flex items-center justify-around border-t shrink-0 safe-bottom"
      style={{
        backgroundColor: 'var(--goblin-cream)',
        borderColor: 'var(--goblin-light)'
      }}
    >
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => !tab.comingSoon && setActiveTab(tab.id)}
          disabled={tab.comingSoon}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] px-2 ${tab.comingSoon ? 'opacity-40' : ''}`}
          style={{
            color: activeTab === tab.id ? 'var(--goblin-moss)' : 'var(--goblin-gray)'
          }}
        >
          <span className="relative">
            {tab.icon}
            {tab.id === 'code' && activeTab !== 'code' && injectionCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ backgroundColor: '#D4A94A' }} />
            )}
          </span>
          <span className="text-[10px] font-medium leading-none">
            {tab.label}
            {tab.comingSoon && <span className="ml-0.5 text-[9px]">Soon</span>}
          </span>
        </button>
      ))}
    </nav>
  );
}