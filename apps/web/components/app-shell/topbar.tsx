"use client";

import { useApp, type AppTab } from "@/contexts/app-context";
import { ModelSwitcher } from "./model-switcher";
import { Settings, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

const TABS: { id: AppTab; label: string; comingSoon?: boolean; tooltip?: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "code", label: "Code" },
  { id: "preview", label: "Preview", comingSoon: true, tooltip: "Coming soon" },
  { id: "server", label: "Server", comingSoon: true, tooltip: "Coming soon" }
];

interface TopbarProps {
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export function Topbar({ onToggleSidebar, sidebarOpen }: TopbarProps) {
  const { activeProject, activeTab, setActiveTab } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="h-14 px-4 flex items-center justify-between border-b shrink-0"
      style={{
        backgroundColor: 'var(--goblin-cream)',
        borderColor: 'var(--goblin-light)'
      }}
    >
      <div className="flex items-center gap-3">
        {/* Hamburger for mobile */}
        <button
          onClick={onToggleSidebar}
          className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg min-h-[44px] min-w-[44px]"
          style={{ color: 'var(--goblin-moss)' }}
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <span
          className="font-[family-name:var(--font-fraunces)] text-xl font-bold"
          style={{ color: 'var(--goblin-moss)' }}
        >
          Goblin
        </span>

        <span className="hidden sm:inline text-sm font-medium" style={{ color: 'var(--goblin-slate)' }}>
          {activeProject ? activeProject.name : "Select a project"}
        </span>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        {/* Desktop tabs — hidden on mobile */}
        <div className="hidden md:flex items-center gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => !tab.comingSoon && setActiveTab(tab.id)}
              disabled={tab.comingSoon}
              className={`px-3 py-2 text-sm font-medium relative transition-colors ${tab.comingSoon ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{
                color: activeTab === tab.id ? 'var(--goblin-moss)' : 'var(--goblin-gray)'
              }}
            >
              {tab.label}
              {tab.comingSoon && <span className="ml-1 text-xs">Soon</span>}
              {activeTab === tab.id && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: 'var(--goblin-moss)' }}
                />
              )}
            </button>
          ))}
        </div>

        <ModelSwitcher />

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 rounded-full flex items-center justify-center min-h-[44px] min-w-[44px]"
            style={{ backgroundColor: 'var(--goblin-moss)', color: 'white' }}
          >
            <span className="text-sm font-medium">U</span>
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-48 rounded-lg border shadow-lg py-1 z-50"
              style={{
                backgroundColor: 'white',
                borderColor: 'var(--goblin-light)'
              }}
            >
              <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50">
                <Settings className="w-4 h-4" style={{ color: 'var(--goblin-gray)' }} />
                Settings
              </button>
              <form action="/logout" method="POST">
                <button className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 text-red-600">
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}