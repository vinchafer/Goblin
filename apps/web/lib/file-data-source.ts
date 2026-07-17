/**
 * WORKSPACE-1 §3 — swappable data source for the Explorer (Wave C · C-6).
 *
 * The point: the SAME FileExplorer component must be able to back the per-project
 * view (v1, shipped) AND a future global "Meine Dateien" view (v1.1) without a
 * second rendering path. The data-access layer is therefore abstracted behind
 * `FileDataSource`; the component reads its listing through this interface, so the
 * source is genuinely swappable (proven by `projectFileDataSource` and the
 * `globalFileDataSource` placeholder implementing the same contract).
 *
 * Honest scope (see _sprint/wave-c/MERGE_REPORT.md): v1 threads the LIST/read path
 * through this interface. The Explorer's mutations still call the per-project
 * endpoints directly; widening the interface to cover them + building the global
 * surface + its backing endpoint is the named v1.1 — NOT a half-shipped global tab.
 */
import { API_URL, getToken } from "@/hooks/code/getToken";

export interface FileEntry {
  path: string;
  size: number;
  modified: string | null;
  createdAt?: string | null;
  lastPushedAt?: string | null;
}

export interface FileDataSource {
  /** Stable discriminator for storage keys / labels / branching. */
  readonly kind: "project" | "global";
  /** List every entry (incl. `.trash/`; the caller filters). */
  listTree(): Promise<FileEntry[]>;
}

async function authGet(path: string): Promise<Response> {
  const token = await getToken();
  return fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
}

/** v1 (shipped): the per-project data source, backed by GET /:id/files-tree. */
export function projectFileDataSource(projectId: string): FileDataSource {
  return {
    kind: "project",
    async listTree() {
      const r = await authGet(`/api/projects/${projectId}/files-tree`);
      const d = await r.json().catch(() => ({}));
      return Array.isArray(d.entries) ? (d.entries as FileEntry[]) : [];
    },
  };
}

/**
 * v1.1 (NOT shipped): the global "Meine Dateien" data source. Declared so the
 * component's data source is provably swappable against the same contract; the
 * backing endpoint and the global surface are the named v1.1 work. It throws an
 * honest, localized-at-call-site error rather than returning phantom data — no
 * half-global tab, no faked listing.
 */
export function globalFileDataSource(): FileDataSource {
  return {
    kind: "global",
    async listTree() {
      throw new Error("global-workspace-v1.1");
    },
  };
}
