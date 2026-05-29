import { useTasks } from '../hooks/useTasks';
import { useAuth } from '../context/AuthContext';
import { CreateTaskForm } from '../components/CreateTaskForm';
import { TaskList } from '../components/TaskList';

export function TasksPage() {
  const { tasks, isLoading, error, toggle, deleteTask, createTask } = useTasks();
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

        <CreateTaskForm onSubmit={createTask} />

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
