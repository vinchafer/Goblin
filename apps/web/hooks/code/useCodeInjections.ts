import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/contexts/app-context';
import { API_URL, getToken } from './getToken';

export interface DiffData {
  filePath: string;
  currentContent: string;
  proposedContent: string;
  diff: string;
}

export interface UndoPayload {
  filePath: string;
  previousContent: string;
}

interface UseCodeInjectionsArgs {
  projectId: string;
  token: string | null;
  pendingCode?: { content: string; filename?: string; files?: { path: string; content: string }[] } | null;
  applyExternalEdit: (filePath: string, content: string, t: string) => Promise<void>;
  loadFileContent: (filePath: string) => Promise<string>;
  openFile: (filePath: string) => Promise<void>;
}

export function useCodeInjections({
  projectId,
  token,
  pendingCode,
  applyExternalEdit,
  loadFileContent,
  openFile,
}: UseCodeInjectionsArgs) {
  const { pendingInjections, addInjection, clearPendingInjections, setPendingCodePayload } = useApp();
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [undoPayload, setUndoPayload] = useState<UndoPayload | null>(null);
  const [injectedFiles, setInjectedFiles] = useState<Set<string>>(new Set());

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const pollInjections = useCallback(async () => {
    const t = await getToken();
    if (!t) return;
    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}/pending-injections`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.injections?.length > 0) {
        for (const inj of data.injections) {
          if (!seenIds.current.has(inj.id)) {
            seenIds.current.add(inj.id);
            addInjection(inj);
            if (inj.filenameHint) setInjectedFiles(prev => new Set(prev).add(inj.filenameHint));
          }
        }
      }
    } catch { /* silent */ }
  }, [projectId, addInjection]);

  useEffect(() => {
    pollInjections();
    pollRef.current = setInterval(pollInjections, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pollInjections]);

  const applyInjectionDirect = useCallback(async (filePath: string, content: string, t: string) => {
    const currentContent = await loadFileContent(filePath);
    setUndoPayload({ filePath, previousContent: currentContent });
    await applyExternalEdit(filePath, content, t);
    setInjectedFiles(prev => new Set(prev).add(filePath));
  }, [loadFileContent, applyExternalEdit]);

  const handleSendToCodeApply = useCallback(async () => {
    if (!pendingCode) return;
    const t = token ?? await getToken();
    if (!t) return;
    // 10.6-2: multi-block send → write each real file directly (no diff modal).
    if (pendingCode.files && pendingCode.files.length > 1) {
      const files = pendingCode.files;
      for (const f of files) {
        await applyInjectionDirect(f.path, f.content, t);
      }
      const first = files[0];
      if (first) await openFile(first.path);
      setPendingCodePayload(null);
      return;
    }
    const filename = pendingCode.filename || 'generated.js';
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/diff`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: filename, proposedContent: pendingCode.content }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDiffData({ filePath: filename, currentContent: data.currentContent, proposedContent: pendingCode.content, diff: data.diff });
    } catch {
      await applyInjectionDirect(filename, pendingCode.content, t);
    }
  }, [pendingCode, projectId, token, applyInjectionDirect, openFile, setPendingCodePayload]);

  const handleDiffApply = useCallback(async () => {
    if (!diffData) return;
    const t = token ?? await getToken();
    if (!t) return;
    await applyInjectionDirect(diffData.filePath, diffData.proposedContent, t);
    setDiffData(null);
    setPendingCodePayload(null);
  }, [diffData, token, applyInjectionDirect, setPendingCodePayload]);

  const handleUndoInjection = useCallback(async () => {
    if (!undoPayload) return;
    const t = token ?? await getToken();
    if (!t) return;
    await fetch(`${API_URL}/api/projects/${projectId}/files/${encodeURIComponent(undoPayload.filePath)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: undoPayload.previousContent }),
    });
    await openFile(undoPayload.filePath);
    setInjectedFiles(prev => { const n = new Set(prev); n.delete(undoPayload.filePath); return n; });
    setUndoPayload(null);
  }, [undoPayload, token, projectId, openFile]);

  return {
    pendingInjections, clearPendingInjections, setPendingCodePayload,
    diffData, setDiffData, undoPayload, injectedFiles,
    handleSendToCodeApply, handleDiffApply, handleUndoInjection,
  };
}
