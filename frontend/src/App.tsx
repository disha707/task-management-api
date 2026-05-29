import { useEffect, useState } from 'react';
import { TaskList } from './components/TaskList';
import type { TaskData } from './types/task';
import './index.css';

const API_BASE = 'http://localhost:3000/tasks';

export default function App() {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(API_BASE)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch tasks');
        return res.json();
      })
      .then((body: { data: TaskData[] }) => {
        setTasks(body.data);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  async function handleToggle(id: number) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !task.completed }),
    });

    if (res.ok) {
      const updated: TaskData = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    }
  }

  async function handleDelete(id: number) {
    const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });

    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="mb-8 text-3xl font-bold text-gray-800">Task Manager</h1>

        {error && (
          <div role="alert" className="mb-6 rounded-lg bg-red-50 p-4 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <TaskList
          tasks={tasks}
          isLoading={isLoading}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
