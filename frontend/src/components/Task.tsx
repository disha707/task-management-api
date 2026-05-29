import type { TaskData } from '../types/task';

interface TaskProps {
  task: TaskData;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}

export function Task({ task, onToggle, onDelete }: TaskProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <input
        type="checkbox"
        checked={task.completed}
        onChange={() => onToggle(task.id)}
        className="mt-1 h-4 w-4 cursor-pointer accent-indigo-600"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-base font-medium ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}
          >
            {task.title}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              task.completed
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {task.completed ? 'Completed' : 'Incomplete'}
          </span>
        </div>

        {task.description !== null && (
          <p
            data-testid="task-description"
            className="mt-1 text-sm text-gray-500"
          >
            {task.description}
          </p>
        )}
      </div>

      <button
        aria-label="Delete"
        onClick={() => onDelete(task.id)}
        className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
