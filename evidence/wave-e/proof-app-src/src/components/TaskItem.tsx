import type { Task } from '../types';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
}

// Wiederverwendbare Komponente: eine einzelne Aufgabe. Kein eigener State —
// sie bekommt die Aufgabe und die Umschalt-Funktion vom Parent (App).
export function TaskItem({ task, onToggle }: TaskItemProps) {
  return (
    <li className={task.done ? 'task task--done' : 'task'}>
      <label className="task__label">
        <input
          type="checkbox"
          className="task__checkbox"
          checked={task.done}
          onChange={() => onToggle(task.id)}
        />
        <span className="task__title">{task.title}</span>
      </label>
    </li>
  );
}
