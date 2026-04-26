"use client";

import { useEffect, useRef, useCallback } from "react";
import { useApp, type PendingInjection } from "@/contexts/app-context";
import { createClient } from "@/lib/supabase/client";
import { Code, FileText, MessageSquare, X } from "lucide-react";

interface CodeTabProps {
  projectId: string;
}

export function CodeTab({ projectId }: CodeTabProps) {
  const { pendingInjections, addInjection, clearPendingInjections } = useApp();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const pollInjections = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBase}/api/projects/${projectId}/pending-injections`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;

      const data = await response.json();
      if (data.injections?.length > 0) {
        for (const inj of data.injections) {
          if (!seenIds.current.has(inj.id)) {
            seenIds.current.add(inj.id);
            addInjection(inj);
          }
        }
      }
    } catch {
      // Silently ignore polling errors
    }
  }, [projectId, addInjection]);

  useEffect(() => {
    pollInjections();
    pollRef.current = setInterval(pollInjections, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pollInjections]);

  return (
    <div className="h-full flex flex-col">
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .injection-card { animation: slideIn 0.2s ease-out; }
      `}</style>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
        {pendingInjections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Code className="w-12 h-12 mb-4" style={{ color: 'var(--goblin-gray)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--goblin-slate)' }}>
              No code injections yet
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--goblin-gray)' }}>
              Use "Send to Code" in Chat to send code here.
            </p>
          </div>
        ) : (
          <>
            {/* Banner */}
            <div
              className="flex items-center justify-between px-4 py-2.5 rounded-lg border"
              style={{ borderColor: '#D4A94A', backgroundColor: 'rgba(212,169,74,0.08)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--goblin-bark)' }}>
                ✦ {pendingInjections.length} new payload{pendingInjections.length !== 1 ? 's' : ''} from Chat
              </span>
              <button
                onClick={clearPendingInjections}
                className="p-1 rounded hover:opacity-60 transition-opacity"
                aria-label="Clear all injections"
              >
                <X className="w-4 h-4" style={{ color: 'var(--goblin-bark)' }} />
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
      <Code className="w-3.5 h-3.5" />
    ) : injection.payloadType === "prompt" ? (
      <MessageSquare className="w-3.5 h-3.5" />
    ) : (
      <FileText className="w-3.5 h-3.5" />
    );

  const typeLabel = injection.payloadType === "code" ? "CODE"
    : injection.payloadType === "prompt" ? "PROMPT"
    : "MIXED";

  const preview = injection.payload.length > 80
    ? injection.payload.slice(0, 80) + '…'
    : injection.payload;

  return (
    <div
      className="injection-card rounded-lg border overflow-hidden"
      style={{ borderColor: '#D4A94A', backgroundColor: 'white' }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ backgroundColor: 'rgba(212,169,74,0.12)', borderBottom: '1px solid rgba(212,169,74,0.3)' }}
      >
        <span style={{ color: '#D4A94A' }}>{typeIcon}</span>
        <span className="text-xs font-bold tracking-wide" style={{ color: '#3A2E1F' }}>
          [{typeLabel}]
        </span>
        {injection.filenameHint && (
          <span className="text-xs ml-1" style={{ color: 'var(--goblin-gray)', fontFamily: 'var(--font-jetbrains-mono, monospace)' }}>
            {injection.filenameHint}
          </span>
        )}
        <span className="text-xs ml-auto" style={{ color: 'var(--goblin-gray)' }}>
          {new Date(injection.createdAt).toLocaleTimeString()}
        </span>
      </div>

      <pre
        className="text-xs whitespace-pre-wrap px-3 py-2.5 overflow-x-auto"
        style={{
          fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", monospace)',
          color: '#2A2A2A',
          backgroundColor: 'white',
        }}
      >
        {preview}
      </pre>
    </div>
  );
}
