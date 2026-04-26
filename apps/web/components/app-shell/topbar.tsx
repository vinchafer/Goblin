"use client";

import { useApp, type AppTab } from "@/contexts/app-context";
import { ModelSwitcher } from "./model-switcher";
import { Settings, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

const TABS: { id: AppTab; label: string; comingSoon?: boolean }[] = [
  { id: "chat", label: "Chat" },
  { id: "code", label: "Code" },
  { id: "preview", label: "Preview", comingSoon: true },
  { id: "server", label: "Server", comingSoon: true }
];

interface TopbarProps {
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export function Topbar({ onToggleSidebar, sidebarOpen }: TopbarProps) {
  const { activeProject, activeTab, setActiveTab, injectionCount } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="h-[52px] px-4 flex items-center justify-between shrink-0"
      style={{ backgroundColor: "var(--goblin-moss)" }}
    >
      {/* Left: hamburger + logo + project chip */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg"
          style={{ color: "rgba(255,255,255,0.7)" }}
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <a href="/dashboard">
          <span
            className="font-fraunces font-bold text-xl"
            style={{ color: "var(--goblin-ochre)", letterSpacing: "-0.5px" }}
          >
            Goblin.
          </span>
        </a>

        {activeProject && (
          <span
            className="hidden sm:inline-flex items-center h-6 px-2.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: "rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.7)",
              fontFamily: "var(--font-dm-sans)"
            }}
          >
            {activeProject.name}
          </span>
        )}
      </div>

      {/* Center: tab switcher — hidden on mobile */}
      <div className="hidden md:flex items-center gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.comingSoon && setActiveTab(tab.id)}
            disabled={tab.comingSoon}
            className="relative h-8 px-4 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor:
                activeTab === tab.id ? "rgba(255,255,255,0.12)" : "transparent",
              color:
                activeTab === tab.id
                  ? "#fff"
                  : "rgba(255,255,255,0.5)",
              fontFamily: "var(--font-dm-sans)"
            }}
          >
            {tab.label}
            {tab.comingSoon && (
              <span className="ml-1 text-[10px] opacity-60">Soon</span>
            )}
            {tab.id === "code" && activeTab !== "code" && injectionCount > 0 && (
              <span
                className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: "var(--goblin-ochre)" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Right: model pill + avatar */}
      <div className="flex items-center gap-2.5">
        <ModelSwitcher />

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
            style={{
              backgroundColor: "var(--goblin-ochre)",
              color: "#fff",
              fontFamily: "var(--font-dm-sans)"
            }}
          >
            U
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-44 rounded-xl border shadow-lg py-1 z-50"
              style={{
                backgroundColor: "#fff",
                borderColor: "var(--goblin-border)"
              }}
            >
              <a
                href="/dashboard/settings"
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5 hover:bg-gray-50"
                style={{ color: "var(--goblin-text)", fontFamily: "var(--font-dm-sans)" }}
                onClick={() => setMenuOpen(false)}
              >
                <Settings className="w-4 h-4" style={{ color: "var(--goblin-meta)" }} />
                Settings
              </a>
              <form action="/logout" method="POST">
                <button
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5 hover:bg-gray-50 text-red-600"
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                >
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
