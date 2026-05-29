import type { TaskData } from '../types/task';
import { Task } from './Task';

interface TaskListProps {
  tasks: TaskData[];
  isLoading: boolean;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}

export function TaskList({ tasks, isLoading, onToggle, onDelete }: TaskListProps) {
  if (isLoading) {
    return (
      <div data-testid="task-list-loading" className="space-y-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-16 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <p className="py-12 text-center text-gray-400">
        No tasks yet. Add one above!
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {tasks.map((task) => (
        <li key={task.id}>
          <Task task={task} onToggle={onToggle} onDelete={onDelete} />
        </li>
      ))}
    </ul>
  );
}
