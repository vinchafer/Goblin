"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { apiStream, apiGet } from "@/lib/api";
import type { ChatMessage } from "@goblin/shared/src/schemas";

interface ChatTabProps {
  projectId: string;
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  selectedModel?: string;
}

interface StreamMessage {
  type: 'meta' | 'delta' | 'done' | 'error';
  // meta fields
  model?: string;
  source_tier?: string;
  provider?: string;
  // delta fields
  content?: string;
  // done fields
  messageId?: string;
  model_used?: string;
  // error fields
  message?: string;
}

export function ChatTab({ projectId, messages, onMessagesChange, selectedModel = 'claude-3-5-sonnet-20241022' }: ChatTabProps) {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Refs for streaming: avoids stale closure when multiple delta events arrive
  // before React re-renders (SSE events are faster than 16ms render cycle)
  const streamingContentRef = useRef('');
  const baseMessagesRef = useRef<ChatMessage[]>([]);
  const streamingMessageRef = useRef<ChatMessage | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const supabase = createClient();

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory();
  }, [projectId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => { abortControllerRef.current?.abort(); };
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const loadChatHistory = async () => {
    try {
      setIsLoadingHistory(true);
      
      const history: ChatMessage[] = await apiGet(`/api/chat/${projectId}/history`);
      onMessagesChange(history);
    } catch (err) {
      console.error('Error loading chat history:', err);
      setError('Failed to load chat history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isStreaming) return;

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      project_id: projectId,
      role: 'user',
      content: trimmedInput,
      model_used: null,
      source_tier: null,
      created_at: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    onMessagesChange(updatedMessages);
    setInput('');
    setIsStreaming(true);
    setError(null);

    // Capture pre-stream state in refs so delta handlers don't use stale closures
    streamingContentRef.current = '';
    baseMessagesRef.current = updatedMessages;

    const streamingMessage: ChatMessage = {
      id: 'streaming',
      project_id: projectId,
      role: 'assistant',
      content: '',
      model_used: null,
      source_tier: null,
      created_at: new Date(),
    };
    streamingMessageRef.current = streamingMessage;

    onMessagesChange([...updatedMessages, streamingMessage]);

    try {
      abortControllerRef.current = new AbortController();
      await apiStream(
        '/api/chat/stream',
        {
          projectId,
          message: trimmedInput,
          modelSlug: selectedModel,
        },
        (data: unknown) => {
          const streamData = data as StreamMessage;

          switch (streamData.type) {
            case 'meta':
              if (streamingMessageRef.current) {
                streamingMessageRef.current = {
                  ...streamingMessageRef.current,
                  model_used: streamData.model || null,
                  source_tier: (streamData.source_tier || null) as ChatMessage['source_tier'],
                };
                onMessagesChange([...baseMessagesRef.current, streamingMessageRef.current]);
              }
              break;

            case 'delta':
              streamingContentRef.current += streamData.content || '';
              if (streamingMessageRef.current) {
                streamingMessageRef.current = {
                  ...streamingMessageRef.current,
                  content: streamingContentRef.current,
                };
                onMessagesChange([...baseMessagesRef.current, streamingMessageRef.current]);
              }
              break;

            case 'done':
              if (streamingMessageRef.current) {
                const finalMsg: ChatMessage = {
                  ...streamingMessageRef.current,
                  id: streamData.messageId || streamingMessageRef.current.id,
                  model_used: streamData.model_used || streamingMessageRef.current.model_used,
                  source_tier: (streamData.source_tier || streamingMessageRef.current.source_tier) as ChatMessage['source_tier'],
                };
                onMessagesChange([...baseMessagesRef.current, finalMsg]);
                streamingMessageRef.current = null;
              }
              setIsStreaming(false);
              break;

            case 'error':
              setError(streamData.message || 'Streaming error');
              setIsStreaming(false);
              onMessagesChange(baseMessagesRef.current);
              streamingMessageRef.current = null;
              break;
          }
        },
        abortControllerRef.current.signal
      );
    } catch (err) {
      console.error('Error in chat stream:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setIsStreaming(false);
      onMessagesChange(baseMessagesRef.current);
      streamingMessageRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    setInput(target.value);
  };

  const handleRetry = () => {
    setError(null);
    loadChatHistory();
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add visual feedback here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const sendToCode = (code: string, filename?: string) => {
    window.dispatchEvent(new CustomEvent('goblin:sendToCode', {
      detail: { code, filename: filename || 'generated-code.js' }
    }));
  };

  // Simple markdown parsing for bold, italic, and inline code
  const parseMarkdown = (text: string) => {
    let parsed = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    
    // Extract code blocks
    const codeBlocks: Array<{ code: string; language?: string }> = [];
    parsed = parsed.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
      const id = `code-${codeBlocks.length}`;
      codeBlocks.push({ code, language });
      return `<div class="code-block-container" data-code-id="${id}"></div>`;
    });

    return { parsed, codeBlocks };
  };

  if (isLoadingHistory) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-moss mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading chat history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-cream flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-ochre">G</span>
            </div>
            <h3 className="text-lg font-semibold text-slate mb-2">What are you building today?</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              Ask questions, get code suggestions, or discuss your project. Your goblin is ready to help!
            </p>
            
            {/* Suggestion pills */}
            <div className="flex flex-wrap justify-center gap-3 max-w-md mx-auto">
              {[
                { text: 'Build a landing page', prompt: 'Create a modern landing page with hero section, features, and contact form' },
                { text: 'Create a REST API', prompt: 'Design a REST API with authentication, CRUD operations, and error handling' },
                { text: 'Add dark mode toggle', prompt: 'Implement a dark mode toggle with CSS variables and localStorage persistence' },
                { text: 'Set up authentication', prompt: 'Set up user authentication with email/password and social login options' },
                { text: 'Optimize performance', prompt: 'Analyze and optimize web performance with lazy loading and code splitting' },
                { text: 'Deploy to production', prompt: 'Guide me through deploying this project to production with best practices' },
              ].map((suggestion) => (
                <button
                  key={suggestion.text}
                  onClick={() => {
                    setInput(suggestion.prompt);
                    textareaRef.current?.focus();
                  }}
                  className="px-4 py-2 bg-cream hover:bg-cream/80 text-slate rounded-full text-sm font-medium transition-colors border border-light"
                >
                  {suggestion.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 mr-3">
                  <div className="w-8 h-8 rounded-full bg-moss flex items-center justify-center">
                    <span className="text-sm font-bold text-ochre">G</span>
                  </div>
                  {message.source_tier && message.model_used && (
                    <div className="mt-1 text-xs text-ochre bg-ochre/10 px-2 py-0.5 rounded-full text-center">
                      via {message.model_used} · {message.source_tier.toUpperCase()}
                    </div>
                  )}
                </div>
              )}
              
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-moss text-white'
                    : 'bg-cream text-slate'
                }`}
              >
                {message.id === 'streaming' && message.content === '' ? (
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                ) : (
                  <>
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ 
                        __html: parseMarkdown(message.content).parsed 
                      }}
                    />
                    
                    {/* Render code blocks separately */}
                    {parseMarkdown(message.content).codeBlocks.map((block, idx) => (
                      <div key={idx} className="mt-3 mb-2">
                        <div className="bg-gray-900 text-gray-100 rounded-lg overflow-hidden">
                          <div className="flex justify-between items-center px-4 py-2 bg-gray-800">
                            <span className="text-sm font-mono">
                              {block.language || 'javascript'}
                            </span>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => copyToClipboard(block.code)}
                                className="text-xs hover:text-white transition-colors"
                              >
                                📋 Copy
                              </button>
                              <button
                                onClick={() => sendToCode(block.code, `generated-${block.language || 'code'}`)}
                                className="text-xs hover:text-white transition-colors"
                              >
                                → Send to Code
                              </button>
                            </div>
                          </div>
                          <pre className="p-4 overflow-x-auto">
                            <code className="font-mono text-sm">{block.code}</code>
                          </pre>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          ))
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 max-w-[80%] mx-auto">
            <p className="text-red-700 text-sm">Something went wrong. Try again.</p>
            <button
              onClick={handleRetry}
              className="mt-2 text-xs bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-full transition-colors"
            >
              Retry
            </button>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-light p-4">
        <div className="flex items-end space-x-3">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder="Chat with your goblin…"
              className="w-full resize-none border border-light rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ochre/20 focus:border-ochre max-h-[200px]"
              rows={1}
              disabled={isStreaming}
            />
            <div className="absolute right-3 bottom-3 text-xs text-gray-400">
              {isStreaming ? 'Streaming…' : 'Enter to send, Shift+Enter for newline'}
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isStreaming}
            className="bg-ochre hover:bg-ochre/90 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-2xl transition-colors"
          >
            {isStreaming ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}