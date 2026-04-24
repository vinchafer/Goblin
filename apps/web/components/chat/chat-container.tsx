"use client";

import { useEffect, useRef, useState } from "react";
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
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState("");
  const supabase = createClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    loadMessages();
  }, [projectId]);

  async function loadMessages() {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    
    setMessages(data || []);
  }

  async function handleSendMessage(content: string) {
    if (isStreaming || !content.trim()) return;

    setIsStreaming(true);
    setCurrentStreamingMessage("");

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      project_id: projectId,
      role: "user",
      content: content.trim(),
      model_used: null,
      source_tier: null,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);

    const es = new EventSource(`/api/chat/stream?projectId=${projectId}&message=${encodeURIComponent(content)}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'token') {
        setCurrentStreamingMessage(prev => prev + data.content);
      } else if (data.type === 'message_end') {
        setMessages(prev => [...prev, {
          id: data.messageId,
          project_id: projectId,
          role: "assistant",
          content: currentStreamingMessage,
          model_used: data.model_used,
          source_tier: data.source_tier,
          created_at: new Date().toISOString()
        }]);
        setCurrentStreamingMessage("");
        setIsStreaming(false);
        es.close();
      }
    };

    es.onerror = () => {
      es.close();
      setIsStreaming(false);
    };
  }

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto w-full px-4 py-6">
      <MessageList 
        messages={messages} 
        isStreaming={isStreaming}
        currentStreamingMessage={currentStreamingMessage}
      />
      <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
    </div>
  );
}