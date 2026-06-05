import { useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useAuth } from '../context/useAuth';
import { CreateTaskForm } from '../components/CreateTaskForm';
import { TaskList } from '../components/TaskList';

const ACTIVE_CLASSES: Record<'All' | 'High' | 'Medium' | 'Low', string> = {
  All: 'rounded-full px-3 py-1 text-xs font-semibold bg-indigo-600 text-white border border-indigo-600',
  High: 'rounded-full px-3 py-1 text-xs font-semibold bg-red-100 text-red-700 border border-red-200',
  Medium: 'rounded-full px-3 py-1 text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200',
  Low: 'rounded-full px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200',
};

const INACTIVE_CLASS =
  'rounded-full px-3 py-1 text-xs font-semibold text-gray-500 bg-white border border-gray-200 hover:border-gray-300 hover:text-gray-700 transition-colors cursor-pointer';

export function TasksPage() {
  const [priorityFilter, setPriorityFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');
  const { tasks, isLoading, error, toggle, deleteTask, createTask } = useTasks(
    priorityFilter !== 'All' ? priorityFilter : undefined,
  );
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800">Task Manager</h1>
          <button
            onClick={logout}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>

        <div role="group" aria-label="Filter by priority" className="flex gap-2 mb-4">
          {(['All', 'High', 'Medium', 'Low'] as const).map((level) => (
            <button
              key={level}
              aria-pressed={priorityFilter === level}
              onClick={() => setPriorityFilter(level)}
              className={priorityFilter === level ? ACTIVE_CLASSES[level] : INACTIVE_CLASS}
            >
              {level}
            </button>
          ))}
        </div>

        <CreateTaskForm onSubmit={(title, description, priority) => createTask(title, description, priority)} />

        {error && (
          <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <TaskList
          tasks={tasks}
          isLoading={isLoading}
          onToggle={toggle}
          onDelete={deleteTask}
        />
      </div>
    </div>
  );
}
