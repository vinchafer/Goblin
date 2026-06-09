import { useEffect } from "react";
import { isDemoActive } from "@/lib/demo/demo-flag";

function isInputFocused() {
  const el = document.activeElement;
  return el instanceof HTMLInputElement
    || el instanceof HTMLTextAreaElement
    || (el instanceof HTMLElement && el.isContentEditable);
}

interface KeyboardShortcutsConfig {
  onCommandPalette: () => void;
  onTabChat: () => void;
  onTabCode: () => void;
  onTabPreview: () => void;
  onToggleSidebar: () => void;
  onSettings: () => void;
  onNewProject: () => void;
  onShortcutsHelp: () => void;
  onFocusChat: () => void;
  onSaveFile?: () => void;
}

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  useEffect(() => {
    // Demo mode (Sprint 10 §6): don't register the global key listener at all —
    // Cmd/Ctrl+K command palette and tab/settings shortcuts stay inert.
    if (isDemoActive()) return;

    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd+K — command palette (always)
      if (mod && e.key === 'k') {
        e.preventDefault();
        config.onCommandPalette();
        return;
      }

      // Cmd+Shift+P — command palette alternative
      if (mod && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        config.onCommandPalette();
        return;
      }

      // Escape — handled per-component, skip here
      if (e.key === 'Escape') return;

      // When input focused: only Cmd+Enter for send is handled by ChatInput itself
      if (isInputFocused()) return;

      // Tab shortcuts
      if (mod && e.key === '1') { e.preventDefault(); config.onTabChat(); return; }
      if (mod && e.key === '2') { e.preventDefault(); config.onTabCode(); return; }
      if (mod && e.key === '3') { e.preventDefault(); config.onTabPreview(); return; }

      // Sidebar
      if (mod && e.key === 'b') { e.preventDefault(); config.onToggleSidebar(); return; }

      // Settings
      if (mod && e.key === ',') { e.preventDefault(); config.onSettings(); return; }

      // New project
      if (mod && e.key === 'n') { e.preventDefault(); config.onNewProject(); return; }

      // Save file
      if (mod && e.key === 's' && config.onSaveFile) { e.preventDefault(); config.onSaveFile(); return; }

      // ? — shortcuts help (no mod, no input)
      if (e.key === '?' && !mod) { config.onShortcutsHelp(); return; }

      // / — focus chat input
      if (e.key === '/' && !mod) { e.preventDefault(); config.onFocusChat(); return; }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [config]);
}
