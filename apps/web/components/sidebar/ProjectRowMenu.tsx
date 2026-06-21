'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { apiPatch, apiDelete } from '@/lib/api';
import { useLang } from '@/lib/use-lang';
import { KebabMenu } from '@/components/manage/KebabMenu';
import { ConfirmDialog, RenameDialog } from '@/components/manage/ManageDialogs';
import { manageLabels } from '@/components/manage/labels';

const Edit16 = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z" /></svg>;
const Trash16 = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>;

/**
 * Kebab (⋮) menu for a single project row — Rename + Delete. Lives inside the
 * clickable row; KebabMenu stops propagation so row navigation
 * (resolveProjectHref) is never triggered. After a mutation we router.refresh()
 * so the server-rendered project list (dashboard/layout.tsx) re-fetches.
 */
export function ProjectRowMenu({ project, onChanged }: { project: { id: string; name: string }; onChanged?: () => void }) {
  const router = useRouter();
  const lang = useLang();
  const L = manageLabels(lang);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refresh = () => { onChanged?.(); router.refresh(); };

  const doRename = async (name: string) => {
    setRenaming(false);
    try {
      await apiPatch(`/api/projects/${project.id}`, { name });
      toast.success(L.renamed);
      refresh();
    } catch {
      toast.error(L.renameFailed);
    }
  };

  const doDelete = async () => {
    try {
      await apiDelete(`/api/projects/${project.id}`);
      toast.success(L.deleted);
      setDeleting(false);
      refresh();
    } catch {
      toast.error(L.deleteFailed);
      setDeleting(false);
    }
  };

  return (
    <>
      <KebabMenu
        ariaLabel={L.more}
        testId="project-kebab"
        items={[
          { label: L.rename, icon: <Edit16 />, testId: 'project-rename', onClick: () => setRenaming(true) },
          { label: L.delete, icon: <Trash16 />, danger: true, testId: 'project-delete', onClick: () => setDeleting(true) },
        ]}
      />
      <RenameDialog
        open={renaming}
        title={L.renameProjectTitle}
        initialValue={project.name}
        placeholder={L.namePlaceholder}
        saveLabel={L.save}
        cancelLabel={L.cancel}
        onSave={doRename}
        onClose={() => setRenaming(false)}
      />
      <ConfirmDialog
        open={deleting}
        title={L.deleteProjectTitle}
        body={L.deleteProjectBody}
        confirmLabel={L.delete}
        cancelLabel={L.cancel}
        onConfirm={doDelete}
        onClose={() => setDeleting(false)}
      />
    </>
  );
}
