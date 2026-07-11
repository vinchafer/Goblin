import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/app-context';
import { useCodeFiles } from '@/hooks/code/useCodeFiles';
import { useCodeVercel } from '@/hooks/code/useCodeVercel';
import { useCodeGitHub } from '@/hooks/code/useCodeGitHub';
import { useCodeTabs } from '@/hooks/code/useCodeTabs';
import { useCodeInjections } from '@/hooks/code/useCodeInjections';

export type { ActiveFile } from '@/hooks/code/useCodeFiles';
export type { DiffData, UndoPayload } from '@/hooks/code/useCodeInjections';

export function useCodeTab(projectId: string, pendingCode?: { content: string; filename?: string; files?: { path: string; content: string }[] } | null) {
  const { setActiveTab } = useApp();

  const filesHook = useCodeFiles(projectId);
  const vercelHook = useCodeVercel(projectId, filesHook.token);
  const githubHook = useCodeGitHub(filesHook.token);
  const tabsHook = useCodeTabs(filesHook.activeFile?.path ?? null);
  const injectionsHook = useCodeInjections({
    projectId,
    token: filesHook.token,
    pendingCode,
    applyExternalEdit: filesHook.applyExternalEdit,
    loadFileContent: filesHook.loadFileContent,
    openFile: filesHook.openFile,
  });

  const [fileTreeOpen, setFileTreeOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === '1') { e.preventDefault(); setActiveTab('chat'); }
      else if (e.key === '2') { e.preventDefault(); setActiveTab('code'); }
      else if (e.key === '3') { e.preventDefault(); setActiveTab('preview'); }
      else if (e.key === 'Escape') {
        if (injectionsHook.diffData) injectionsHook.setDiffData(null);
        if (githubHook.pushModalOpen) githubHook.setPushModalOpen(false);
        if (githubHook.connectGitHubOpen) githubHook.setConnectGitHubOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setActiveTab, injectionsHook, githubHook]);

  const openFileAndTrack = async (filePath: string) => {
    await filesHook.openFile(filePath);
    setMobileDrawerOpen(false);
  };

  return {
    // Files
    files: filesHook.files,
    activeFile: filesHook.activeFile,
    editorContent: filesHook.editorContent,
    loading: filesHook.loading,
    saving: filesHook.saving,
    isDirty: filesHook.isDirty,
    token: filesHook.token,
    pendingFileSwitch: filesHook.pendingFileSwitch,
    setPendingFileSwitch: filesHook.setPendingFileSwitch,
    openFile: openFileAndTrack,
    saveFile: filesHook.saveFile,
    handleEditorChange: filesHook.handleEditorChange,
    confirmSwitch: filesHook.confirmSwitch,
    fetchFiles: filesHook.fetchFiles,

    // Tabs (open files)
    openFiles: tabsHook.openFiles,
    closeTab: tabsHook.closeTab,

    // Vercel
    deploying: vercelHook.deploying,
    deployMessage: vercelHook.deployMessage,
    handleDeploy: vercelHook.handleDeploy,
    activeBuilds: vercelHook.activeBuilds,
    recentDone: vercelHook.recentDone,
    needsVercel: vercelHook.needsVercel,
    dismissNeedsVercel: vercelHook.dismissNeedsVercel,
    policyBlock: vercelHook.policyBlock,
    dismissPolicyBlock: vercelHook.dismissPolicyBlock,

    // GitHub
    pushModalOpen: githubHook.pushModalOpen,
    setPushModalOpen: githubHook.setPushModalOpen,
    connectGitHubOpen: githubHook.connectGitHubOpen,
    setConnectGitHubOpen: githubHook.setConnectGitHubOpen,
    openPushModal: githubHook.openPushModal,

    // Injections
    pendingInjections: injectionsHook.pendingInjections,
    clearPendingInjections: injectionsHook.clearPendingInjections,
    diffData: injectionsHook.diffData,
    setDiffData: injectionsHook.setDiffData,
    undoPayload: injectionsHook.undoPayload,
    injectedFiles: injectionsHook.injectedFiles,
    handleSendToCodeApply: injectionsHook.handleSendToCodeApply,
    handleDiffApply: injectionsHook.handleDiffApply,
    handleDiffApplyContent: injectionsHook.handleDiffApplyContent,
    handleUndoInjection: injectionsHook.handleUndoInjection,
    setPendingCodePayload: injectionsHook.setPendingCodePayload,

    // UI
    fileTreeOpen, setFileTreeOpen,
    mobileDrawerOpen, setMobileDrawerOpen,
  };
}
