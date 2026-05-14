"use client";

import { useState, useRef, useEffect } from "react";
import { PaperPlaneTilt, Microphone } from "@phosphor-icons/react";
import { useVoiceInput } from "@/hooks/use-voice-input";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isListening, isSupported, startListening, stopListening } = useVoiceInput(
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
    if (e.key === 'Enter' && !e.shiftKey) {
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
          placeholder="Chat with your goblin…"
          rows={1}
          className="w-full px-12 py-3 bg-transparent resize-none focus:outline-none text-base"
          style={{
            color: 'var(--goblin-slate)',
            minHeight: '56px',
            maxHeight: '200px'
          }}
        />
        {/* Mic button — left side (voice input) */}
        {isSupported && (
          <button
            onClick={isListening ? stopListening : startListening}
            className="absolute left-2 bottom-2 w-10 h-10 rounded-lg flex items-center justify-center touch-manipulation transition-all"
            title={isListening ? 'Stop listening' : 'Voice input'}
            style={{
              color: isListening ? 'var(--danger)' : 'var(--goblin-gray)',
              background: isListening ? 'rgba(184,92,60,0.1)' : 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Microphone className="w-4 h-4" style={{ animation: isListening ? 'pulse 1s ease-in-out infinite' : undefined }} />
          </button>
        )}
        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="absolute right-2 bottom-2 w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-50 touch-manipulation transition-opacity"
          style={{ backgroundColor: 'var(--goblin-moss)' }}
        >
          <PaperPlaneTilt className="w-4 h-4 text-white" />
        </button>
      </div>
      <p className="text-xs text-center mt-2" style={{ color: 'var(--goblin-gray)' }}>
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}