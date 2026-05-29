import { http, HttpResponse } from 'msw';
import type { TaskData } from '../types/task';

export const API = 'http://localhost:3000/tasks';
export const AUTH_API = 'http://localhost:3000/auth';
export const FAKE_TOKEN = 'test.jwt.token';

export const defaultTasks: TaskData[] = [
  { id: 1, title: 'First task', description: null, completed: false, createdAt: '2024-01-01T00:00:00.000Z' },
  { id: 2, title: 'Second task', description: 'Some details', completed: true, createdAt: '2024-01-02T00:00:00.000Z' },
];

export const handlers = [
  // ─── Auth ──────────────────────────────────────────────────────────────────

  http.post(`${AUTH_API}/register`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    if (body.email === 'taken@example.com') {
      return HttpResponse.json({ message: 'Email already registered' }, { status: 409 });
    }
    return HttpResponse.json({ access_token: FAKE_TOKEN }, { status: 201 });
  }),

  http.post(`${AUTH_API}/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    if (body.password === 'wrong') {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    return HttpResponse.json({ access_token: FAKE_TOKEN });
  }),

  // ─── Tasks ─────────────────────────────────────────────────────────────────

  http.get(API, () =>
    HttpResponse.json({
      data: defaultTasks,
      meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
    }),
  ),

  http.post(API, async ({ request }) => {
    const body = await request.json() as { title: string; description?: string };
    const created: TaskData = {
      id: 99,
      title: body.title,
      description: body.description ?? null,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch(`${API}/:id`, async ({ params, request }) => {
    const id = Number(params.id);
    const body = await request.json() as Partial<TaskData>;
    const task = defaultTasks.find((t) => t.id === id) ?? defaultTasks[0];
    return HttpResponse.json({ ...task, ...body });
  }),

  http.delete(`${API}/:id`, ({ params }) => {
    const id = Number(params.id);
    const task = defaultTasks.find((t) => t.id === id) ?? defaultTasks[0];
    return HttpResponse.json(task);
  }),
];
