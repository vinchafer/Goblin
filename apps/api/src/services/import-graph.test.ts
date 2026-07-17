// WAVE-E E1 — import-graph parser tests + the M14 token measurement on a real
// 15-file React/Vite project (the ledger row is filled from this run's numbers).

import { describe, it, expect } from 'vitest';
import {
  extractSpecifiers,
  extractExports,
  resolveLocalImport,
  packageName,
  buildImportGraph,
  hasModuleEdges,
  renderProjectGraph,
  type FileForGraph,
} from './import-graph';

describe('extractSpecifiers', () => {
  it('covers static/side-effect/dynamic/require/re-export forms', () => {
    const src = `
      import React from 'react';
      import { useState, useEffect } from 'react';
      import * as utils from './utils';
      import './styles.css';
      import type { Task } from './types';
      export { Foo } from './foo';
      export * from './bar';
      const cfg = require('./config');
      const lazy = () => import('./Heavy');
    `;
    const specs = extractSpecifiers(src);
    expect(specs).toContain('react');
    expect(specs).toContain('./utils');
    expect(specs).toContain('./styles.css');
    expect(specs).toContain('./types');
    expect(specs).toContain('./foo');
    expect(specs).toContain('./bar');
    expect(specs).toContain('./config');
    expect(specs).toContain('./Heavy');
    // deduped: react appears twice in source, once in the list
    expect(specs.filter((s) => s === 'react')).toHaveLength(1);
  });
});

describe('extractExports', () => {
  it('captures default, named declarations, and export lists (not re-exports)', () => {
    const src = `
      export default function App() {}
      export const TWO = 2;
      export function helper() {}
      export class Widget {}
      const a = 1, b = 2;
      export { a, b as bee };
      export { Nope } from './elsewhere';
    `;
    const ex = extractExports(src);
    expect(ex).toContain('default');
    expect(ex).toContain('TWO');
    expect(ex).toContain('helper');
    expect(ex).toContain('Widget');
    expect(ex).toContain('a');
    expect(ex).toContain('bee'); // `b as bee` exports as bee
    // a re-export `export { Nope } from …` is an edge, NOT a local export
    expect(ex).not.toContain('Nope');
  });
});

describe('resolveLocalImport', () => {
  const known = new Set([
    'src/App.tsx',
    'src/components/TaskItem.tsx',
    'src/types.ts',
    'src/hooks/index.ts',
    'src/styles.css',
  ]);
  it('resolves sibling with extension inference', () => {
    expect(resolveLocalImport('src/App.tsx', './components/TaskItem', known)).toBe('src/components/TaskItem.tsx');
  });
  it('resolves parent-relative and index files', () => {
    expect(resolveLocalImport('src/components/TaskItem.tsx', '../types', known)).toBe('src/types.ts');
    expect(resolveLocalImport('src/App.tsx', './hooks', known)).toBe('src/hooks/index.ts');
  });
  it('resolves an exact asset import', () => {
    expect(resolveLocalImport('src/App.tsx', './styles.css', known)).toBe('src/styles.css');
  });
  it('returns null for a bare (external) specifier', () => {
    expect(resolveLocalImport('src/App.tsx', 'react', known)).toBeNull();
  });
  it('returns null for an unresolvable local path (honest, not fabricated)', () => {
    expect(resolveLocalImport('src/App.tsx', './does-not-exist', known)).toBeNull();
  });
});

describe('packageName', () => {
  it('reduces subpaths to the installable package name', () => {
    expect(packageName('react')).toBe('react');
    expect(packageName('react-dom/client')).toBe('react-dom');
    expect(packageName('@vitejs/plugin-react')).toBe('@vitejs/plugin-react');
    expect(packageName('@scope/pkg/deep/sub')).toBe('@scope/pkg');
  });
});

describe('hasModuleEdges — the static-path detection gate', () => {
  it('is FALSE for a vanilla static project (byte-identical static path preserved)', () => {
    const files: FileForGraph[] = [
      { path: 'index.html', content: '<!doctype html><script src="app.js"></script>' },
      { path: 'app.js', content: 'document.querySelector("h1").textContent = "hi";' },
      { path: 'styles.css', content: 'h1{color:red}' },
    ];
    expect(hasModuleEdges(files)).toBe(false);
    expect(renderProjectGraph(files)).toBe('');
  });
  it('is TRUE once a source has an import/export', () => {
    const files: FileForGraph[] = [
      { path: 'src/main.tsx', content: "import App from './App';" },
      { path: 'src/App.tsx', content: 'export default function App(){return null}' },
    ];
    expect(hasModuleEdges(files)).toBe(true);
  });
});

// ─── The 15-file React/Vite fixture (E4-shaped: TaskItem is a real separate import) ──
// Contents are REALISTICALLY FORMATTED (multi-line, whitespace, as the beauty block
// requires generated code to be) — NOT minified — so the M14 measurement reflects what
// the agent actually writes, not an artificially compact toy.
function reactAppFixture(): FileForGraph[] {
  return [
    { path: 'index.html', content: `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aufgabenliste</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
` },
    { path: 'package.json', content: `{
  "name": "aufgabenliste",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "4.3.4",
    "typescript": "5.6.3",
    "vite": "5.4.11"
  }
}
` },
    { path: 'vite.config.ts', content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
});
` },
    { path: 'tsconfig.json', content: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true
  },
  "include": ["src"]
}
` },
    { path: 'src/main.tsx', content: `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root-Element #root wurde nicht gefunden.');
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
` },
    { path: 'src/App.tsx', content: `import { TaskItem } from './components/TaskItem';
import { AddTask } from './components/AddTask';
import { useTasks } from './hooks/useTasks';
import type { Task } from './types';

// Der State lebt hier im Parent; TaskItem ist eine wiederverwendbare Kind-Komponente.
export default function App() {
  const { tasks, add, toggle } = useTasks();

  return (
    <main className="app">
      <h1>Meine Aufgaben</h1>
      <AddTask onAdd={add} />
      <ul className="task-list">
        {tasks.map((task: Task) => (
          <TaskItem key={task.id} task={task} onToggle={toggle} />
        ))}
      </ul>
    </main>
  );
}
` },
    { path: 'src/types.ts', content: `export interface Task {
  id: string;
  title: string;
  done: boolean;
}

export type TaskId = Task['id'];
` },
    { path: 'src/components/TaskItem.tsx', content: `import type { Task } from '../types';
import { Checkbox } from './Checkbox';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
}

// Wiederverwendbare Komponente: zeigt eine einzelne Aufgabe an.
export function TaskItem({ task, onToggle }: TaskItemProps) {
  return (
    <li className={task.done ? 'task task--done' : 'task'}>
      <Checkbox checked={task.done} onChange={() => onToggle(task.id)} />
      <span className="task__title">{task.title}</span>
    </li>
  );
}
` },
    { path: 'src/components/AddTask.tsx', content: `import { useState } from 'react';
import { Button } from './Button';

interface AddTaskProps {
  onAdd: (title: string) => void;
}

export function AddTask({ onAdd }: AddTaskProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue('');
  };

  return (
    <form className="add-task" onSubmit={handleSubmit}>
      <input
        className="add-task__input"
        placeholder="Neue Aufgabe…"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <Button>Hinzufügen</Button>
    </form>
  );
}
` },
    { path: 'src/components/Checkbox.tsx', content: `interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
}

export function Checkbox({ checked, onChange }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className="checkbox"
      checked={checked}
      onChange={onChange}
    />
  );
}
` },
    { path: 'src/components/Button.tsx', content: `import type { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
}

export function Button({ children, onClick }: ButtonProps) {
  return (
    <button className="button" type="submit" onClick={onClick}>
      {children}
    </button>
  );
}
` },
    { path: 'src/hooks/useTasks.ts', content: `import { useCallback, useState } from 'react';
import type { Task } from '../types';
import { uid } from '../lib/uid';

// Kapselt die Aufgaben-Logik: der State bleibt im Parent, die Aktionen sind hier.
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const add = useCallback((title: string) => {
    setTasks((prev) => [...prev, { id: uid(), title, done: false }]);
  }, []);

  const toggle = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
    );
  }, []);

  return { tasks, add, toggle };
}
` },
    { path: 'src/hooks/useLocalStorage.ts', content: `import { useEffect, useState } from 'react';

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
` },
    { path: 'src/lib/uid.ts', content: `// Kleine ID-Hilfsfunktion — bewusst ohne externe Abhängigkeit.
export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
` },
    { path: 'src/styles.css', content: `:root {
  --sage: #6b7f6e;
  --copper: #b06a3c;
}

.app {
  max-width: 32rem;
  margin: 2rem auto;
  font-family: system-ui, sans-serif;
}

.task-list {
  list-style: none;
  padding: 0;
}

.task {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem 0;
}

.task--done .task__title {
  text-decoration: line-through;
  opacity: 0.6;
}

.button {
  padding: 0.5rem 1rem;
  background: var(--copper);
  color: white;
  border: none;
  border-radius: 0.375rem;
}
` },
  ];
}

describe('buildImportGraph on the 15-file React app', () => {
  const files = reactAppFixture();
  const graph = buildImportGraph(files);

  it('wires TaskItem as a real importing component (edge evidence for E4)', () => {
    const app = graph.nodes.find((n) => n.path === 'src/App.tsx')!;
    expect(app.imports).toContain('src/components/TaskItem.tsx');
    const taskItem = graph.nodes.find((n) => n.path === 'src/components/TaskItem.tsx')!;
    expect(taskItem.imports).toContain('src/types.ts');
    expect(taskItem.imports).toContain('src/components/Checkbox.tsx');
    expect(taskItem.exports).toContain('TaskItem');
    expect(taskItem.packages).not.toContain('react'); // TaskItem imports react types only via ../types, not react directly
  });

  it('collects external packages as installable names', () => {
    const main = graph.nodes.find((n) => n.path === 'src/main.tsx')!;
    expect(main.packages).toContain('react');
    expect(main.packages).toContain('react-dom'); // from 'react-dom/client'
  });

  it('leaves no unresolved local edges in a correct project (honest resolution)', () => {
    const totalUnresolved = graph.nodes.reduce((s, n) => s + n.unresolved.length, 0);
    expect(totalUnresolved).toBe(0);
  });

  // ── M14 MEASUREMENT — graph summary vs full-content injection ──
  it('is dramatically cheaper than full-content injection (M14 ledger figures)', () => {
    const graphText = renderProjectGraph(files);
    const fullText = files
      .filter((f) => f.content != null)
      .map((f) => `Datei: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
      .join('\n\n');
    const graphChars = graphText.length;
    const fullChars = fullText.length;
    const graphTok = Math.round(graphChars / 4);
    const fullTok = Math.round(fullChars / 4);
    // Printed so the exact numbers land in the test run → copied verbatim into M14.
    // eslint-disable-next-line no-console
    console.log(
      `\n[M14 MEASUREMENT · 15-file React app]\n` +
      `  graph summary : ${graphChars} chars ≈ ${graphTok} tok\n` +
      `  full-content  : ${fullChars} chars ≈ ${fullTok} tok\n` +
      `  ratio         : ${(fullChars / graphChars).toFixed(1)}× cheaper\n` +
      `  budget share  : graph = ${((graphChars / 48000) * 100).toFixed(1)}% of the 48k M2 budget\n`,
    );
    // Robust invariants (not an engineered ratio): the map is cheaper than the full
    // dump AND fits the M2 budget with room to spare. The exact ratio is whatever the
    // console.log above reports — copied verbatim into the M14 ledger row, not asserted
    // against an inflated target.
    expect(graphChars).toBeLessThan(fullChars);
    expect(graphChars).toBeLessThan(48000 / 4); // graph stays well under a quarter of the budget
  });
});
