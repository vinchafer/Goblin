'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Creates a NEW chat for this project (a chat_sessions row bound to project_id)
// and opens it via the shared StandaloneChat. Project chats are now real
// multi-session threads — listed in the hub "Letzte Chats" card and in the
// sidebar (with the project label) — instead of one endless chat_messages
// stream. (10.7-13)
export function ProjectChatLaunch({
  projectId,
  label = 'Neuer Chat',
  className = 'gobl-btn primary',
  style,
}: {
  projectId: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function open() {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { router.push('/login'); return; }
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/chat-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) { setBusy(false); return; }
      const created = await res.json() as { id: string };
      router.push(`/dashboard/chat/${created.id}`);
    } catch {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={open} disabled={busy} className={className} style={style}>
      {busy ? 'Öffne…' : label} {!busy && '→'}
    </button>
  );
}
