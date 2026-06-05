'use client';

import { useEffect, useState } from 'react';
import { StandaloneChat } from '@/components/chat/standalone-chat';
import { GoblinLogo } from '@/components/brand/GoblinLogo';
import { createClient } from '@/lib/supabase/client';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  has_code: boolean;
  created_at: string;
}

/**
 * 11A-A — the project workspace "Chat" tab.
 *
 * Before: the workspace rendered its own ChatTab (an English, chat_messages-based
 * surface) — a SECOND, different chat window. Going back from the Code tab landed
 * the user there instead of the conversation they were in.
 *
 * Now: it renders the ONE canonical chat (StandaloneChat — German, memory-backed,
 * standalone_messages). It returns you to:
 *   1) the conversation you came from (stashed on Send-to-Code), else
 *   2) the project's most recent chat session, else
 *   3) a fresh session bound to the project.
 *
 * Send-to-Code stays intact: StandaloneChat still routes to ?tab=code.
 */
export function ProjectChatSurface({ projectId, projectName }: { projectId: string; projectName?: string | null }) {
  const [state, setState] = useState<{ sessionId: string; messages: Msg[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
      const auth = { Authorization: `Bearer ${token}` };

      // 1) the conversation we came from (set by StandaloneChat's Send-to-Code).
      let sessionId: string | null = null;
      try { sessionId = sessionStorage.getItem(`goblin:lastChat:${projectId}`); } catch { /* ignore */ }

      // 2) else the project's most recent chat session (list is updated_at desc).
      if (!sessionId) {
        try {
          const res = await fetch(`${apiBase}/api/chat-sessions`, { headers: auth });
          if (res.ok) {
            const list = await res.json() as Array<{ id: string; project_id: string | null }>;
            const mine = list.filter(s => s.project_id === projectId);
            if (mine.length) sessionId = mine[0]!.id;
          }
        } catch { /* ignore */ }
      }

      // 3) else create one bound to the project.
      if (!sessionId) {
        try {
          const res = await fetch(`${apiBase}/api/chat-sessions`, {
            method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId }),
          });
          if (res.ok) sessionId = (await res.json() as { id: string }).id;
        } catch { /* ignore */ }
      }
      if (!sessionId || cancelled) return;

      let messages: Msg[] = [];
      try {
        const res = await fetch(`${apiBase}/api/chat-sessions/${sessionId}`, { headers: auth });
        if (res.ok) {
          const d = await res.json() as { messages?: Msg[] };
          messages = d.messages ?? [];
        }
      } catch { /* ignore */ }

      if (!cancelled) setState({ sessionId, messages });
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  if (!state) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bone)' }}>
        <GoblinLogo state="breath" size={28} variant="green" />
      </div>
    );
  }

  return (
    <StandaloneChat
      sessionId={state.sessionId}
      initialMessages={state.messages}
      projectId={projectId}
      projectName={projectName ?? null}
    />
  );
}
