import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL, getToken } from './getToken';

export interface ActiveFile {
  path: string;
  content: string;
}

export function useCodeFiles(projectId: string) {
  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<ActiveFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [pendingFileSwitch, setPendingFileSwitch] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedContentRef = useRef<string>('');

  useEffect(() => {
    getToken().then(t => setToken(t));
  }, []);

  const fetchFiles = useCallback(async () => {
    const t = await getToken();
    if (!t) return;
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/files`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      setFiles(data.files || []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const loadFileContent = useCallback(async (filePath: string): Promise<string> => {
    const t = await getToken();
    if (!t) return '';
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/files/${encodeURIComponent(filePath)}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      return data.content || '';
    } catch { return ''; }
  }, [projectId]);

  const openFile = useCallback(async (filePath: string) => {
    if (isDirty && activeFile) { setPendingFileSwitch(filePath); return; }
    const content = await loadFileContent(filePath);
    setActiveFile({ path: filePath, content });
    setEditorContent(content);
    savedContentRef.current = content;
    setIsDirty(false);
  }, [isDirty, activeFile, loadFileContent]);

  const saveFile = useCallback(async (contentToSave: string) => {
    if (!activeFile || !token) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/projects/${projectId}/files/${encodeURIComponent(activeFile.path)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: contentToSave }),
      });
      savedContentRef.current = contentToSave;
      setIsDirty(false);
    } catch { /* silent */ } finally { setSaving(false); }
  }, [activeFile, projectId, token]);

  const handleEditorChange = useCallback((newContent: string) => {
    setEditorContent(newContent);
    setIsDirty(newContent !== savedContentRef.current);
  }, []);

  useEffect(() => {
    if (!activeFile || !isDirty) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveFile(editorContent), 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [editorContent, activeFile?.path, isDirty, saveFile]);

  const confirmSwitch = useCallback(async (save: boolean) => {
    if (!pendingFileSwitch) return;
    if (save && activeFile) await saveFile(editorContent);
    setIsDirty(false);
    const target = pendingFileSwitch;
    setPendingFileSwitch(null);
    const content = await loadFileContent(target);
    setActiveFile({ path: target, content });
    setEditorContent(content);
    savedContentRef.current = content;
  }, [pendingFileSwitch, activeFile, editorContent, saveFile, loadFileContent]);

  const applyExternalEdit = useCallback(async (filePath: string, content: string, t: string) => {
    await fetch(`${API_URL}/api/projects/${projectId}/files/${encodeURIComponent(filePath)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    await fetchFiles();
    await openFile(filePath);
  }, [projectId, fetchFiles, openFile]);

  return {
    files, activeFile, editorContent, loading, saving, isDirty, token,
    pendingFileSwitch, setPendingFileSwitch,
    fetchFiles, openFile, saveFile, handleEditorChange, confirmSwitch,
    loadFileContent, applyExternalEdit,
  };
}
