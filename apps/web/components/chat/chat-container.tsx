"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/contexts/app-context";
import type { ChatMessage } from "@goblin/shared/src/schemas";

interface ChatContainerProps {
  projectId: string;
}

export function ChatContainer({ projectId }: ChatContainerProps) {
  const { activeModel } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  
  const streamAccumRef = useRef("");
  const supabase = useMemo(() => createClient(), []);

  const loadMessages = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setIsLoadingHistory(false);
        return;
      }

      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiBase}/api/chat/${projectId}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const messagesData = await res.json();
        if (Array.isArray(messagesData) && messagesData.length > 0) {
          setMessages(messagesData.map((m: any) => ({
            id: m.id,
            project_id: m.project_id,
            role: m.role,
            content: m.content,
            model_used: m.model_used,
            source_tier: m.source_tier,
            created_at: new Date(m.created_at),
          })));
        }
      }
    } catch {
      // Silently fail — fallback to empty
    } finally {
      setIsLoadingHistory(false);
    }
  }, [projectId, supabase]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  async function handleSendMessage(content: string) {
    if (isStreaming || !content.trim()) return;

    setIsStreaming(true);
    streamAccumRef.current = "";
    setStreamingText("");

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      project_id: projectId,
      role: "user",
      content: content.trim(),
      model_used: null,
      source_tier: null,
      created_at: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setIsStreaming(false);
        return;
      }

      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const modelSlug = activeModel.slug || activeModel.id;
      const response = await fetch(`${apiBase}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ projectId, message: content, modelSlug })
      });

      if (!response.ok) {
        setIsStreaming(false);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          try {
            const jsonStr = line.slice(6);
            const parsed = JSON.parse(jsonStr);
            
            if (parsed.type === 'token') {
              streamAccumRef.current += parsed.content;
              setStreamingText(streamAccumRef.current);
            } else if (parsed.type === 'message_end') {
              setMessages(prev => [...prev, {
                id: parsed.messageId,
                project_id: projectId,
                role: 'assistant',
                content: streamAccumRef.current,
                model_used: parsed.model_used,
                source_tier: parsed.source_tier,
                created_at: new Date()
              }]);
              setStreamingText('');
              streamAccumRef.current = '';
              setIsStreaming(false);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    } catch {
      // Error handled silently, streaming state reset
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto w-full px-4 py-6">
      <div className="flex-1 overflow-y-auto pb-4">
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          currentStreamingMessage={streamingText}
          isLoadingHistory={isLoadingHistory}
          onSuggestionClick={handleSendMessage}
        />
      </div>
      <div className="sticky bottom-0 pt-2 safe-bottom" style={{ backgroundColor: 'var(--goblin-cream)' }}>
        <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
      </div>
    </div>
  );
}