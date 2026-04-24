"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          className="w-full px-4 py-3 pr-12 bg-transparent resize-none focus:outline-none"
          style={{
            color: 'var(--goblin-slate)',
            minHeight: '56px',
            maxHeight: '200px'
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="absolute right-3 bottom-3 w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50"
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