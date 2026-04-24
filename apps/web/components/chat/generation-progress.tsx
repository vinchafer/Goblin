"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle, File } from "lucide-react";

interface GenerationProgressProps {
  projectId: string;
  onComplete: () => void;
}

export function GenerationProgress({ projectId, onComplete }: GenerationProgressProps) {
  const [status, setStatus] = useState<'planning' | 'generating' | 'complete' | 'error'>('planning');
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [fileCount, setFileCount] = useState(0);

  useEffect(() => {
    // This will be connected to SSE stream from chat container
    const fakeProgress = async () => {
      await new Promise(r => setTimeout(r, 1000));
      setStatus('planning');
      await new Promise(r => setTimeout(r, 1500));
      setStatus('generating');

      const files = ['package.json', 'app/page.tsx', 'README.md', 'tailwind.config.ts'];
      for (let i = 0; i < files.length; i++) {
        setCurrentFile(files[i]);
        setProgress(Math.round(((i + 1) / files.length) * 100));
        await new Promise(r => setTimeout(r, 800));
      }

      setFileCount(files.length);
      setStatus('complete');
      setTimeout(onComplete, 1500);
    };

    fakeProgress();
  }, [onComplete]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-96 rounded-xl shadow-xl border p-4" style={{ backgroundColor: 'white', borderColor: 'var(--goblin-light)' }}>
      <div className="flex items-center gap-3 mb-3">
        {status === 'complete' ? (
          <CheckCircle className="w-5 h-5" style={{ color: 'var(--goblin-good)' }} />
        ) : (
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--goblin-moss)' }} />
        )}
        <span className="font-medium" style={{ color: 'var(--goblin-slate)' }}>
          {status === 'planning' && 'Planning project structure...'}
          {status === 'generating' && `Generating ${currentFile}`}
          {status === 'complete' && `✓ ${fileCount} files generated`}
        </span>
      </div>

      {status === 'generating' && (
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--goblin-light)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, backgroundColor: 'var(--goblin-moss)' }}
          />
        </div>
      )}
    </div>
  );
}