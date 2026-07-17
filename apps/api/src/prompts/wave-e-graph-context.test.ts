// WAVE-E E1 — the import-graph block is wired into the SHARED project-context render
// (both base chat and agent), and — critically — it is additive behind detection so
// the static-app prompt stays BYTE-IDENTICAL (LIVE-USER regression rule).

import { describe, it, expect } from 'vitest';
import { buildGoblinChatSystemPrompt, buildAgentSystemPrompt } from './goblin-chat-system';

const STATIC_FILES = [
  { path: 'index.html', size: 120, content: '<!doctype html><h1>Hi</h1><script src="app.js"></script>' },
  { path: 'app.js', size: 60, content: 'document.querySelector("h1").textContent = "Hallo";' },
  { path: 'styles.css', size: 30, content: 'h1{color:#b06a3c}' },
];

const REACT_FILES = [
  { path: 'src/main.tsx', size: 90, content: "import { createRoot } from 'react-dom/client';\nimport App from './App';\ncreateRoot(document.getElementById('root')!).render(<App />);" },
  { path: 'src/App.tsx', size: 120, content: "import { TaskItem } from './components/TaskItem';\nexport default function App() { return <TaskItem />; }" },
  { path: 'src/components/TaskItem.tsx', size: 80, content: "export function TaskItem() { return <li>task</li>; }" },
];

describe('E1 — static-path: no graph BLOCK renders (per-project context byte-identical)', () => {
  // Sentinels are the RENDERED graph block, not the instructional prose: the block
  // header + a rendered edge line (`path · nutzt: …`, with the middot). The static
  // instructional text about frameworks is a uniform capability addition (like the
  // web_search / restore_checkpoint tool docs) and is present for all runs — it is NOT
  // the per-project graph render, which is what must stay absent for a static project.
  it('a vanilla static project renders NO graph block in chat', () => {
    const chat = buildGoblinChatSystemPrompt({ projectName: 'Static', files: STATIC_FILES });
    expect(chat).not.toContain('Projektstruktur (Abhängigkeitsgraph');
    expect(chat).not.toContain(' · nutzt:');
    expect(chat).not.toContain(' · exportiert:');
  });

  it('a vanilla static project renders NO graph block in the agent prompt', () => {
    const agent = buildAgentSystemPrompt({ projectName: 'Static', files: STATIC_FILES });
    expect(agent).not.toContain('Projektstruktur (Abhängigkeitsgraph');
    expect(agent).not.toContain(' · nutzt:');
    expect(agent).not.toContain(' · exportiert:');
  });
});

describe('E1 — module projects get the graph', () => {
  it('a React project renders the dependency graph in BOTH chat and agent prompts', () => {
    for (const build of [buildGoblinChatSystemPrompt, buildAgentSystemPrompt]) {
      const p = build({ projectName: 'Tasks', files: REACT_FILES });
      expect(p).toContain('Projektstruktur (Abhängigkeitsgraph');
      // App imports TaskItem — the edge must be present and resolved.
      expect(p).toContain('src/App.tsx');
      expect(p).toContain('nutzt: src/components/TaskItem.tsx');
      // main.tsx pulls react-dom as an external package.
      expect(p).toContain('Pakete: react-dom');
      // TaskItem exports its component name.
      expect(p).toContain('exportiert: TaskItem');
    }
  });

  it('mentions read_file as the on-demand escape hatch (graph is the map, not the bodies)', () => {
    const p = buildAgentSystemPrompt({ projectName: 'Tasks', files: REACT_FILES });
    expect(p).toContain('read_file');
  });
});
