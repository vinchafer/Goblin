"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProviderRow } from "@/components/settings/provider-row";

interface ApiKey {
  id: string;
  provider: string;
  key_last_four: string;
  created_at: string;
}

interface Provider {
  id: string;
  name: string;
  description: string;
  docsUrl: string;
  keyHint: string;
  emoji: string;
}

const PROVIDERS: Provider[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models — best for coding",
    docsUrl: "https://console.anthropic.com/settings/keys",
    keyHint: "sk-ant-...",
    emoji: "🤖"
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o and o1 models",
    docsUrl: "https://platform.openai.com/api-keys",
    keyHint: "sk-...",
    emoji: "⚡"
  },
  {
    id: "google",
    name: "Google AI Studio",
    description: "Gemini 2.0 Flash — fast and free tier available",
    docsUrl: "https://aistudio.google.com/app/apikey",
    keyHint: "AIza...",
    emoji: "🔍"
  },
  {
    id: "groq",
    name: "Groq",
    description: "Llama 3.3 70B — extremely fast inference",
    docsUrl: "https://console.groq.com/keys",
    keyHint: "gsk_...",
    emoji: "🚀"
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "DeepSeek V3 — powerful and affordable",
    docsUrl: "https://platform.deepseek.com",
    keyHint: "sk-...",
    emoji: "💎"
  },
  {
    id: "mistral",
    name: "Mistral",
    description: "Mistral Large — European AI",
    docsUrl: "https://console.mistral.ai",
    keyHint: "sk-...",
    emoji: "🇪🇺"
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    description: "Grok 2 — real-time web knowledge",
    docsUrl: "https://console.x.ai",
    keyHint: "xai-...",
    emoji: "🤯"
  },
  {
    id: "together",
    name: "Together AI",
    description: "100+ open source models",
    docsUrl: "https://api.together.xyz/settings/api-keys",
    keyHint: "tgsk_...",
    emoji: "🌐"
  }
];

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"api-keys" | "account">("api-keys");
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const tab = searchParams.get("tab") as "api-keys" | "account" | null;
    if (tab && (tab === "api-keys" || tab === "account")) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBase}/api/byok-keys`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load API keys: ${response.status}`);
      }

      const keys: ApiKey[] = await response.json();
      setApiKeys(keys);
    } catch (err) {
      console.error('Error loading API keys:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveKey = async (provider: string, key: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBase}/api/byok-keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider, key }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save API key');
      }

      await loadApiKeys();
      return { success: true };
    } catch (err) {
      console.error('Error saving API key:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to save API key' 
      };
    }
  };

  const handleDeleteKey = async (provider: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBase}/api/byok-keys/${provider}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete API key: ${response.status}`);
      }

      await loadApiKeys();
      return { success: true };
    } catch (err) {
      console.error('Error deleting API key:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to delete API key' 
      };
    }
  };

  const getKeyForProvider = (providerId: string) => {
    return apiKeys.find(key => key.provider === providerId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate mb-2">Settings</h1>
          <p className="text-gray-600">Manage your API keys and account settings</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-8">
          <button
            onClick={() => {
              setActiveTab("api-keys");
              router.push("/settings?tab=api-keys");
            }}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              activeTab === "api-keys"
                ? "text-ochre border-b-2 border-ochre"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            API Keys
          </button>
          <button
            onClick={() => {
              setActiveTab("account");
              router.push("/settings?tab=account");
            }}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              activeTab === "account"
                ? "text-ochre border-b-2 border-ochre"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Account
          </button>
        </div>

        {/* Content */}
        {activeTab === "api-keys" ? (
          <div className="max-w-2xl">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate mb-2">Bring Your Own Key (BYOK)</h2>
              <p className="text-gray-600">
                Connect your API keys to use premium models. Your keys are encrypted and never leave our servers.
              </p>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white rounded-xl border border-light p-4 animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                        <div>
                          <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-48"></div>
                        </div>
                      </div>
                      <div className="h-8 bg-gray-200 rounded w-24"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {PROVIDERS.map((provider) => {
                  const key = getKeyForProvider(provider.id);
                  return (
                    <ProviderRow
                      key={provider.id}
                      provider={provider}
                      isConnected={!!key}
                      keyLastFour={key?.key_last_four}
                      onSave={handleSaveKey}
                      onDelete={handleDeleteKey}
                    />
                  );
                })}
              </div>
            )}

            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <h3 className="font-medium text-blue-800 mb-1">How it works</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Your API keys are encrypted with AES-256-GCM before storage</li>
                <li>• Keys are only used for your own requests</li>
                <li>• We validate keys with a test request before saving</li>
                <li>• You can remove keys at any time</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl">
            <div className="bg-white rounded-xl border border-light p-6">
              <h2 className="text-xl font-semibold text-slate mb-4">Account Settings</h2>
              <p className="text-gray-600 mb-6">
                Manage your account preferences and personal information.
              </p>
              
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-slate mb-2">Email</h3>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">user@example.com</span>
                    <button className="text-sm text-ochre hover:text-ochre/80 font-medium">
                      Change
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-slate mb-2">Password</h3>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">••••••••</span>
                    <button className="text-sm text-ochre hover:text-ochre/80 font-medium">
                      Change
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <h3 className="font-medium text-slate mb-2">Delete Account</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                  <button className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 hover:bg-red-50 rounded-lg transition-colors">
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}