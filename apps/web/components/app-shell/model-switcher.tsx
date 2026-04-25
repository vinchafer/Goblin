"use client";

import { useState } from "react";
import { ChevronDown, Bot, Zap, Key } from "lucide-react";
import { useApp, type AppModel, type ModelTier } from "@/contexts/app-context";

const MODELS: AppModel[] = [
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", tier: "byok", icon: "🔑", available: true },
  { id: "claude-opus-4-7", name: "Claude Opus 4.7", tier: "byok", icon: "🔑", available: true },
  { id: "gpt-4o", name: "GPT-4o", tier: "byok", icon: "🔑", available: true },
  { id: "qwen-coder-32b", name: "Qwen Coder 32B", tier: "hosted", icon: "🤖", available: false, badge: "Phase 3" },
  { id: "qwen-coder-14b", name: "Qwen Coder 14B (fast)", tier: "hosted", icon: "🤖", available: false, badge: "Phase 3" },
  { id: "gemini-2-flash", name: "Gemini 2.0 Flash", tier: "free", icon: "⚡", available: false, badge: "Phase 2" },
  { id: "llama-3.3-70b", name: "Llama 3.3 70B (Groq)", tier: "free", icon: "🦙", available: false, badge: "Phase 2" },
];

const TIER_LABELS: Record<ModelTier, string> = {
  hosted: "Goblin Hosted",
  free: "Free API",
  byok: "BYOK"
};

const TIER_COLORS: Record<ModelTier, string> = {
  hosted: 'var(--goblin-moss)',
  free: 'var(--goblin-ochre)',
  byok: 'var(--goblin-gray)'
};

export function ModelSwitcher() {
  const { activeModel, setActiveModel } = useApp();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium"
        style={{
          backgroundColor: 'white',
          borderColor: 'var(--goblin-light)',
          color: 'var(--goblin-slate)'
        }}
      >
        <span>{activeModel.icon}</span>
        <span>{activeModel.name}</span>
        <ChevronDown className="w-4 h-4" style={{ color: 'var(--goblin-gray)' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-64 rounded-lg border shadow-lg py-2 z-50"
          style={{
            backgroundColor: 'white',
            borderColor: 'var(--goblin-light)'
          }}
        >
          {Object.entries(TIER_LABELS).map(([tier, label]) => (
            <div key={tier}>
              <div className="px-3 py-1.5 text-xs font-medium uppercase" style={{ color: 'var(--goblin-gray)' }}>
                {label}
              </div>
              {MODELS.filter(m => m.tier === tier).map(model => (
                <button
                  key={model.id}
                  onClick={() => {
                    if (model.available) {
                      setActiveModel(model);
                      localStorage.setItem('goblin_active_model', JSON.stringify(model));
                      setOpen(false);
                    }
                  }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${model.available ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'} ${activeModel.id === model.id ? 'bg-gray-50' : ''}`}
                >
                  <span>{model.icon}</span>
                  <span style={{ color: model.available ? 'var(--goblin-slate)' : 'var(--goblin-gray)' }}>{model.name}</span>
                  
                  {model.badge && (
                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--goblin-light)', color: 'var(--goblin-gray)' }}>
                      {model.badge}
                    </span>
                  )}
                  
                  {activeModel.id === model.id && !model.badge && (
                    <span className="ml-auto w-2 h-2 rounded-full" style={{ backgroundColor: TIER_COLORS[tier as ModelTier] }} />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}