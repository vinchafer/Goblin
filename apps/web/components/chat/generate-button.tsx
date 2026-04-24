"use client";

interface GenerateButtonProps {
  message: string;
  onGenerate: () => void;
}

export function GenerateButton({ message, onGenerate }: GenerateButtonProps) {
  const generationKeywords = ['build', 'create', 'make me', 'generate', 'setup', 'create me', 'build me'];

  const shouldShowButton = generationKeywords.some(keyword =>
    message.toLowerCase().includes(keyword)
  );

  if (!shouldShowButton) return null;

  return (
    <button
      onClick={onGenerate}
      className="mt-3 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
      style={{ backgroundColor: 'var(--goblin-ochre)', color: 'white' }}
    >
      🔨 Generate Project
    </button>
  );
}