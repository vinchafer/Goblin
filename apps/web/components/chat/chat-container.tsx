"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@goblin/shared/src/schemas";

interface ChatContainerProps {
  projectId: string;
}

export function ChatContainer({ projectId }: ChatContainerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  
  const streamAccumRef = useRef("");
  const supabase = useMemo(() => createClient(), []);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    
    setMessages(data || []);
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
      const response = await fetch(`${apiBase}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ projectId, message: content })
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
        />
      </div>
      <div className="sticky bottom-0 pt-2 safe-bottom" style={{ backgroundColor: 'var(--goblin-cream)' }}>
        <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
      </div>
    </div>
  );
}