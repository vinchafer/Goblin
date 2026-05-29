"use client";

import { useState } from "react";

interface Provider {
  id: string;
  name: string;
  description: string;
  docsUrl: string;
  keyHint: string;
  emoji: string;
}

interface ProviderRowProps {
  provider: Provider;
  isConnected: boolean;
  keyLastFour?: string;
  onSave: (provider: string, key: string) => Promise<{ success: boolean; error?: string }>;
  onDelete: (provider: string) => Promise<{ success: boolean; error?: string }>;
}

export function ProviderRow({ provider, isConnected, keyLastFour, onSave, onDelete }: ProviderRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = () => {
    setIsExpanded(true);
    setError(null);
  };

  const handleCancel = () => {
    setIsExpanded(false);
    setKey("");
    setShowKey(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!key.trim()) {
      setError("Please enter an API key");
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await onSave(provider.id, key.trim());
    
    if (result.success) {
      setIsExpanded(false);
      setKey("");
      setShowKey(false);
    } else {
      setError(result.error || "Failed to save API key");
    }

    setIsLoading(false);
  };

  const handleRemove = async () => {
    if (!confirm(`Are you sure you want to remove your ${provider.name} API key?`)) {
      return;
    }

    setIsLoading(true);
    const result = await onDelete(provider.id);
    
    if (!result.success) {
      setError(result.error || "Failed to remove API key");
    }

    setIsLoading(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Main row */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl">
              {provider.emoji}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-ink-1">{provider.name}</h3>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className={`text-sm ${isConnected ? 'text-green-600' : 'text-gray-500'}`}>
                  {isConnected ? `Connected · ···· ${keyLastFour}` : "Not connected"}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{provider.description}</p>
            </div>
          </div>

          <div>
            {isConnected ? (
              <button
                onClick={handleRemove}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Removing..." : "Remove"}
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-brand-gold border border-brand-gold hover:bg-brand-gold/5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expandable panel */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="max-w-md">
            <h4 className="font-medium text-ink-1 mb-3">Paste your {provider.name} API key</h4>
            
            <div className="mb-4">
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={provider.keyHint}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold pr-24"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-600 hover:text-gray-800"
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
              
              <div className="mt-2 flex items-center justify-between">
                <a
                  href={provider.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-gold hover:text-brand-gold/80 flex items-center"
                >
                  Get your key →
                </a>
                <span className="text-xs text-gray-500">
                  {key.length}/100
                </span>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading || !key.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-gold hover:bg-brand-gold/90 rounded-lg transition-colors flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Saving..." : "Save key"}
              </button>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                Your API key is encrypted with AES-256-GCM before storage. We'll validate it with a test request to {provider.name}.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}