"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Project } from "@goblin/shared/src/schemas";

export type AppTab = "chat" | "code" | "preview" | "server";
export type ModelTier = "hosted" | "free" | "byok";

export interface PendingInjection {
  id: string;
  payload: string;
  payloadType: "code" | "prompt" | "mixed";
  createdAt: string;
}

export interface AppModel {
  id: string;
  name: string;
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
  clearPendingInjections: () => void;
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
  const clearPendingInjections = useCallback(() => setPendingInjections([]), []);

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
      clearPendingInjections,
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