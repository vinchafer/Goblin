"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { Project } from "@goblin/shared/src/schemas";

export type AppTab = "chat" | "code" | "preview" | "server";
export type ModelTier = "hosted" | "free" | "byok";

export interface PendingInjection {
  id: string;
  payload: string;
  payloadType: "code" | "prompt" | "mixed";
  filenameHint?: string;
  createdAt: string;
}

export interface AppModel {
  id: string;
  name: string;
  slug?: string;
  provider?: string;
  tier: ModelTier;
  icon: string;
  available?: boolean;
  badge?: string;
}

interface AppContextType {
  activeProject: Project | null;
  setActiveProject: (project: Project | null) => void;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  activeModel: AppModel;
  setActiveModel: (model: AppModel) => void;
  pendingInjections: PendingInjection[];
  setPendingInjections: (injections: PendingInjection[]) => void;
  addInjection: (injection: PendingInjection) => void;
  clearPendingInjections: () => void;
  injectionCount: number;
  showNewProjectModal: boolean;
  setShowNewProjectModal: (show: boolean) => void;
  newProjectIdea: string;
  setNewProjectIdea: (idea: string) => void;
  showSettingsSheet: boolean;
  setShowSettingsSheet: (show: boolean) => void;
  settingsInitialItem: string | null;
  setSettingsInitialItem: (item: string | null) => void;
  pendingCodePayload: { content: string; filename?: string } | null;
  setPendingCodePayload: (payload: { content: string; filename?: string } | null) => void;
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_MODEL: AppModel = {
  id: "qwen-coder-32b",
  name: "Qwen Coder 32B",
  tier: "hosted",
  icon: "🤖"
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("chat");
  const [activeModel, setActiveModel] = useState<AppModel>(DEFAULT_MODEL);
  const [pendingInjections, setPendingInjections] = useState<PendingInjection[]>([]);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectIdea, setNewProjectIdea] = useState('');
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [settingsInitialItem, setSettingsInitialItem] = useState<string | null>(null);
  const [pendingCodePayload, setPendingCodePayload] = useState<{ content: string; filename?: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const clearPendingInjections = useCallback(() => setPendingInjections([]), []);
  const addInjection = useCallback((injection: PendingInjection) => {
    setPendingInjections(prev => {
      if (prev.some(i => i.id === injection.id)) return prev;
      return [...prev, injection];
    });
  }, []);
  const injectionCount = pendingInjections.length;

  // Listen for send-to-code events
  useEffect(() => {
    const handleSendToCode = (event: CustomEvent<{ code: string; filename?: string }>) => {
      setPendingCodePayload({
        content: event.detail.code,
        filename: event.detail.filename
      });
      setActiveTab("code");
    };

    // Add event listener
    window.addEventListener('goblin:sendToCode', handleSendToCode as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('goblin:sendToCode', handleSendToCode as EventListener);
    };
  }, []);

  return (
    <AppContext.Provider value={{
      activeProject,
      setActiveProject,
      activeTab,
      setActiveTab,
      activeModel,
      setActiveModel,
      pendingInjections,
      setPendingInjections,
      addInjection,
      clearPendingInjections,
      injectionCount,
      showNewProjectModal,
      setShowNewProjectModal,
      newProjectIdea,
      setNewProjectIdea,
      showSettingsSheet,
      setShowSettingsSheet,
      settingsInitialItem,
      setSettingsInitialItem,
      pendingCodePayload,
      setPendingCodePayload,
      previewUrl,
      setPreviewUrl,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}