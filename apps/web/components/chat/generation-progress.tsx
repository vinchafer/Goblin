"use client";

import { useEffect, useState } from "react";
import { CircleNotch, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useBuildStatus } from "@/contexts/build-context";

interface GenerationProgressProps {
  projectId: string;
  byokKeyId: string;
  prompt: string;
  onComplete: () => void;
}

export function GenerationProgress({ projectId, byokKeyId, prompt, onComplete }: GenerationProgressProps) {
  const [status, setStatus] = useState<'planning' | 'generating' | 'complete' | 'error'>('planning');
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [fileCount, setFileCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const { setBuildStatus } = useBuildStatus();
  const supabase = createClient();

  useEffect(() => {
    async function startGeneration() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;

        if (!token) {
          throw new Error('Not authenticated');
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://goblinapi-production.up.railway.app';
        const response = await fetch(`${apiUrl}/api/projects/${projectId}/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ prompt, byokKeyId })
        });

        if (!response.ok) {
          throw new Error('Generation failed');
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

              if (parsed.type === 'planning') {
                setStatus('planning');
                setBuildStatus({ 
                  isBuilding: true, 
                  progress: 5, 
                  currentAction: 'Planning structure...' 
                });
              } else if (parsed.type === 'generating_file') {
                setStatus('generating');
                setCurrentFile(parsed.path);
                setProgress(parsed.progress);
                setBuildStatus({ 
                  isBuilding: true, 
                  progress: parsed.progress, 
                  currentAction: `Generating ${parsed.path}` 
                });
              } else if (parsed.type === 'complete') {
                setFileCount(parsed.fileCount);
                setStatus('complete');
                setBuildStatus({ 
                  isBuilding: true, 
                  progress: 100, 
                  currentAction: 'Complete' 
                });
                
                setTimeout(() => {
                  setBuildStatus({ isBuilding: false, progress: 0, currentAction: '' });
                  onComplete();
                }, 2000);
              } else if (parsed.type === 'error') {
                throw new Error(parsed.message);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Generation failed');
        setBuildStatus({ isBuilding: false, progress: 0, currentAction: '' });
      }
    }

    startGeneration();
  }, [projectId, byokKeyId, prompt, onComplete, supabase, setBuildStatus]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-96 rounded-xl shadow-xl border p-4" style={{ backgroundColor: 'white', borderColor: 'var(--goblin-light)' }}>
      <div className="flex items-center gap-3 mb-3">
        {status === 'complete' ? (
          <CheckCircle className="w-5 h-5" style={{ color: 'var(--goblin-good)' }} />
        ) : status === 'error' ? (
          <WarningCircle className="w-5 h-5" style={{ color: 'var(--goblin-warn)' }} />
        ) : (
          <CircleNotch className="w-5 h-5 animate-spin" style={{ color: 'var(--goblin-moss)' }} />
        )}
        <span className="font-medium" style={{ color: 'var(--goblin-slate)' }}>
          {status === 'planning' && 'Planning project structure...'}
          {status === 'generating' && `Generating ${currentFile}`}
          {status === 'complete' && `✓ ${fileCount} files generated`}
          {status === 'error' && errorMessage}
        </span>
      </div>

      {(status === 'generating' || status === 'planning') && (
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