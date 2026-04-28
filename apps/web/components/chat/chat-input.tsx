"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Mic } from "lucide-react";
import { useVoiceInput } from "@/hooks/use-voice-input";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isListening, isSupported, startListening } = useVoiceInput(
    (text) => setValue(prev => prev + (prev ? ' ' : '') + text)
  );

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleSubmit = () => {
    if (disabled || !value.trim()) return;
    onSend(value);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="mt-4">
      <div className="relative rounded-xl border shadow-sm" style={{ backgroundColor: 'white', borderColor: 'var(--goblin-light)' }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Tell your goblin what to build..."
          rows={1}
          className="w-full px-4 py-3 pr-12 bg-transparent resize-none focus:outline-none text-base"
          style={{
            color: 'var(--goblin-slate)',
            minHeight: '56px',
            maxHeight: '200px'
          }}
        />
        {/* Mic button — left side */}
        {isSupported && (
          <button
            onClick={() => {
              try { startListening(); } catch { setToast('Microphone access denied'); setTimeout(() => setToast(null), 3000); }
            }}
            disabled={disabled}
            className="absolute left-2 bottom-2 w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-50 transition-all"
            style={{
              backgroundColor: isListening ? 'rgba(184, 92, 60, 0.15)' : 'transparent',
              color: isListening ? '#B85C3C' : 'var(--goblin-gray)',
            }}
            title={isListening ? 'Listening…' : 'Voice input'}
          >
            <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
          </button>
        )}
        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="absolute right-2 bottom-2 w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-50 touch-manipulation"
          style={{ backgroundColor: 'var(--goblin-moss)' }}
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
      <p className="text-xs text-center mt-2" style={{ color: 'var(--goblin-gray)' }}>
        Press Cmd+Enter to send
      </p>
    </div>
  );
}