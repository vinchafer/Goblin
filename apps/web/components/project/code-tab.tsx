"use client";

import { useEffect, useRef, useCallback } from "react";
import { useApp, type PendingInjection } from "@/contexts/app-context";
import { createClient } from "@/lib/supabase/client";
import { Code, FileText, MessageSquare } from "lucide-react";

interface CodeTabProps {
  projectId: string;
}

export function CodeTab({ projectId }: CodeTabProps) {
  const { pendingInjections, setPendingInjections, clearPendingInjections } = useApp();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollInjections = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) return;

      const response = await fetch(`/api/projects/${projectId}/pending-injections`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      if (data.injections && data.injections.length > 0) {
        setPendingInjections(data.injections);
      }
    } catch {
      // Silently ignore polling errors
    }
  }, [projectId, setPendingInjections]);

  useEffect(() => {
    // Poll immediately on mount
    pollInjections();

    // Then poll every 3 seconds
    pollRef.current = setInterval(pollInjections, 3000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [pollInjections]);

  return (
    <div className="h-full flex flex-col">
      {/* Injected items list */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {pendingInjections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Code className="w-12 h-12 mb-4" style={{ color: 'var(--goblin-gray)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--goblin-slate)' }}>
              No code injections yet
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--goblin-gray)' }}>
              Use "Send to Code" buttons in the Chat tab to send code here.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--goblin-slate)' }}>
                Injected Items ({pendingInjections.length})
              </h2>
              <button
                onClick={clearPendingInjections}
                className="text-xs px-3 py-1 rounded-md hover:opacity-80 transition-opacity"
                style={{
                  backgroundColor: 'rgba(212, 169, 74, 0.15)',
                  color: 'var(--goblin-bark)',
                }}
              >
                Clear All
              </button>
            </div>

            {pendingInjections.map((injection) => (
              <InjectionCard key={injection.id} injection={injection} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function InjectionCard({ injection }: { injection: PendingInjection }) {
  const typeIcon =
    injection.payloadType === "code" ? (
      <Code className="w-4 h-4" />
    ) : injection.payloadType === "prompt" ? (
      <MessageSquare className="w-4 h-4" />
    ) : (
      <FileText className="w-4 h-4" />
    );

  const typeLabel =
    injection.payloadType === "code"
      ? "Code"
      : injection.payloadType === "prompt"
        ? "Prompt"
        : "Mixed";

  const typeColor =
    injection.payloadType === "code"
      ? "var(--goblin-good)"
      : injection.payloadType === "prompt"
        ? "var(--goblin-ochre)"
        : "var(--goblin-warn)";

  return (
    <div
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'white',
        borderColor: 'var(--goblin-light)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: typeColor }}>{typeIcon}</span>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: `${typeColor}20`,
            color: typeColor,
          }}
        >
          {typeLabel}
        </span>
        <span className="text-xs ml-auto" style={{ color: 'var(--goblin-gray)' }}>
          {new Date(injection.createdAt).toLocaleTimeString()}
        </span>
      </div>

      <pre
        className="text-sm whitespace-pre font-mono p-3 rounded-md overflow-x-auto max-h-64 overflow-y-auto"
        style={{
          backgroundColor: 'var(--goblin-slate)',
          color: '#E5E5E5',
        }}
      >
        {injection.payload}
      </pre>
    </div>
  );
}