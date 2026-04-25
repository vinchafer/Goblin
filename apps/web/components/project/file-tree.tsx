"use client";

import { useState } from "react";
import { File, Folder, ChevronRight, ChevronDown, Download } from "lucide-react";

interface FileTreeProps {
  projectId: string;
  files: string[];
  onFileClick: (path: string) => void;
}

export function FileTree({ projectId, files, onFileClick }: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const tree = buildTree(files);

  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--goblin-light)' }}>
      <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--goblin-light)', backgroundColor: 'var(--goblin-cream)' }}>
        <span className="font-medium" style={{ color: 'var(--goblin-slate)' }}>Project Files</span>
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL}/api/projects/${projectId}/download`}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium"
          style={{ backgroundColor: 'var(--goblin-moss)', color: 'white' }}
        >
          <Download className="w-4 h-4" />
          Download ZIP
        </a>
      </div>

      <div className="p-2 max-h-64 overflow-y-auto">
        {renderTreeNode(tree, '', expandedFolders, toggleFolder, onFileClick)}
      </div>
    </div>
  );
}

function buildTree(paths: string[]) {
  const root: Record<string, any> = {};

  for (const path of paths) {
    const parts = path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      if (!current[part]) {
        current[part] = i === parts.length - 1 ? null : {};
      }
      current = current[part];
    }
  }

  return root;
}

function renderTreeNode(
  node: any,
  path: string,
  expanded: Set<string>,
  onToggle: (path: string) => void,
  onFileClick: (path: string) => void
): React.ReactNode {
  return Object.entries(node).map(([name, children]) => {
    const fullPath = path ? `${path}/${name}` : name;
    const isFolder = children !== null;

    return (
      <div key={fullPath}>
        <div
          className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer"
          onClick={() => isFolder ? onToggle(fullPath) : onFileClick(fullPath)}
        >
          {isFolder ? (
            expanded.has(fullPath)
              ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--goblin-gray)' }} />
              : <ChevronRight className="w-4 h-4" style={{ color: 'var(--goblin-gray)' }} />
          ) : (
            <span className="w-4" />
          )}

          {isFolder
            ? <Folder className="w-4 h-4" style={{ color: 'var(--goblin-ochre)' }} />
            : <File className="w-4 h-4" style={{ color: 'var(--goblin-gray)' }} />
          }

          <span className="text-sm" style={{ color: 'var(--goblin-slate)' }}>{name}</span>
        </div>

        {isFolder && expanded.has(fullPath) && (
          <div className="ml-4">
            {renderTreeNode(children, fullPath, expanded, onToggle, onFileClick)}
          </div>
        )}
      </div>
    );
  });
}