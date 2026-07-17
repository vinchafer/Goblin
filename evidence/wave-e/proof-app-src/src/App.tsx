import { useState } from 'react';
import { TaskItem } from './components/TaskItem';
import type { Task } from './types';
import './App.css';

let nextId = 3;

// Der State (die Aufgabenliste) lebt im PARENT. TaskItem ist eine eigene,
// wiederverwendbare Komponente, die pro Aufgabe importiert und gerendert wird.
export default function App() {
  const [tasks, setTasks] = useState<Task[]>([
    { id: '1', title: 'Wave E fertig bauen', done: false },
    { id: '2', title: 'Live stellen', done: false },
  ]);
  const [draft, setDraft] = useState('');

  const toggle = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setTasks((prev) => [...prev, { id: String(nextId++), title, done: false }]);
    setDraft('');
  };

  const openCount = tasks.filter((t) => !t.done).length;

  return (
    <main className="shell">
      <span className="badge">Aufgabenliste</span>
      <h1>Meine Aufgaben</h1>
      <p className="lead">Noch {openCount} offen.</p>

      <form className="add" onSubmit={add}>
        <input
          className="add__input"
          placeholder="Neue Aufgabe…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="add__button" type="submit">Hinzufügen</button>
      </form>

      <ul className="task-list">
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} onToggle={toggle} />
        ))}
      </ul>
    </main>
  );
}
