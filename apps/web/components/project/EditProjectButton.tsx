'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { apiPatch } from '@/lib/api';
import { useLang } from '@/lib/use-lang';
import { EditProjectDialog } from '@/components/manage/ManageDialogs';
import { manageLabels } from '@/components/manage/labels';

const Edit16 = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z" />
  </svg>
);

/**
 * FOUNDER-WALK-7 · U5 — the project hub had no way to change name/description once
 * created (only new-project-modal.tsx sets them, at creation). Same RenameDialog
 * convention as ProjectRowMenu.tsx (sidebar kebab menu) — apiPatch + toast +
 * router.refresh() so this server-rendered page re-fetches — extended to the
 * EditProjectDialog (name + description) instead of the single-field RenameDialog,
 * and reused here rather than inventing a second edit surface.
 */
export function EditProjectButton({
  projectId, initialName, initialDescription,
}: { projectId: string; initialName: string; initialDescription: string | null }) {
  const router = useRouter();
  const lang = useLang();
  const L = manageLabels(lang);
  const [open, setOpen] = useState(false);

  const save = async ({ name, description }: { name: string; description: string }) => {
    setOpen(false);
    try {
      await apiPatch(`/api/projects/${projectId}`, { name, description: description || null });
      toast.success(L.saved);
      router.refresh();
    } catch {
      toast.error(L.saveFailed);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="gobl-btn ghost lg"
        data-testid="edit-project-trigger"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
      >
        <Edit16 /> {L.editProject}
      </button>
      <EditProjectDialog
        open={open}
        title={L.editProjectTitle}
        namePlaceholder={L.namePlaceholder}
        descriptionPlaceholder={L.descriptionPlaceholder}
        initialName={initialName}
        initialDescription={initialDescription ?? ''}
        saveLabel={L.save}
        cancelLabel={L.cancel}
        onSave={save}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
