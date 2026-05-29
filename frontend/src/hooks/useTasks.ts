import { useCallback, useEffect, useState } from 'react';
import type { TaskData } from '../types/task';

const API = 'http://localhost:3000/tasks';
const TOKEN_KEY = 'auth_token';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

export function useTasks() {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(API, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch tasks');
        return res.json();
      })
      .then((body: { data: TaskData[] }) => setTasks(body.data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  const toggle = useCallback(async (id: number) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );

    try {
      const res = await fetch(`${API}/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ completed: !task.completed }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const updated: TaskData = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
    }
  }, [tasks]);

  const deleteTask = useCallback(async (id: number) => {
    const snapshot = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));

    try {
      const res = await fetch(`${API}/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to delete');
    } catch {
      setTasks(snapshot);
    }
  }, [tasks]);

  const createTask = useCallback(async (title: string, description?: string) => {
    const res = await fetch(API, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ title, description }),
    });
    if (!res.ok) throw new Error('Failed to create task');
    const created: TaskData = await res.json();
    setTasks((prev) => [created, ...prev]);
    return created;
  }, []);

  return { tasks, isLoading, error, toggle, deleteTask, createTask };
}
