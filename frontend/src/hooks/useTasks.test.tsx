/**
 * Unit tests for the useTasks custom hook.
 *
 * Scope:
 *   These tests verify the hook's state machine: initial fetch, loading/error
 *   states, and all mutating actions (toggle, delete, create).
 *   Network calls are intercepted by MSW — no real HTTP traffic.
 *
 * Coverage:
 *   - isLoading is true on mount, false once data arrives
 *   - tasks array is populated from the API response on mount
 *   - error is set and tasks stays empty when the fetch fails
 *   - toggle: optimistically flips completed in local state, then confirms
 *     with the server response
 *   - toggle: rolls back the optimistic update when the PATCH fails
 *   - deleteTask: optimistically removes the task, confirms on 200
 *   - deleteTask: rolls back when DELETE fails
 *   - createTask: sends POST and prepends the new task to the list
 *
 * What is NOT covered:
 *   - UI rendering → App.test.tsx, TaskList.test.tsx
 *   - Form validation → CreateTaskForm.test.tsx
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../mocks/server';
import { API, defaultTasks } from '../mocks/handlers';
import { useTasks } from './useTasks';

describe('useTasks', () => {
  // ─── initial fetch ────────────────────────────────────────────────────────

  it('starts in a loading state', () => {
    const { result } = renderHook(() => useTasks());

    expect(result.current.isLoading).toBe(true);
  });

  it('populates tasks after successful fetch', async () => {
    const { result } = renderHook(() => useTasks());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.tasks).toHaveLength(2);
    expect(result.current.tasks[0].title).toBe('First task');
  });

  it('sets error and leaves tasks empty when fetch fails', async () => {
    server.use(
      http.get(API, () => HttpResponse.json({ message: 'Server error' }, { status: 500 })),
    );

    const { result } = renderHook(() => useTasks());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeTruthy();
    expect(result.current.tasks).toHaveLength(0);
  });

  // ─── toggle ───────────────────────────────────────────────────────────────

  it('optimistically flips completed then confirms with server value', async () => {
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const original = result.current.tasks[0]; // completed: false

    await act(async () => {
      await result.current.toggle(original.id);
    });

    expect(result.current.tasks[0].completed).toBe(true);
  });

  it('rolls back optimistic toggle when PATCH fails', async () => {
    server.use(
      http.patch(`${API}/:id`, () => HttpResponse.json({ message: 'Error' }, { status: 500 })),
    );

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const original = result.current.tasks[0]; // completed: false

    await act(async () => {
      await result.current.toggle(original.id);
    });

    // Should roll back to original value
    expect(result.current.tasks[0].completed).toBe(false);
  });

  // ─── deleteTask ───────────────────────────────────────────────────────────

  it('optimistically removes the task then confirms on success', async () => {
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.deleteTask(defaultTasks[0].id);
    });

    expect(result.current.tasks.find((t) => t.id === defaultTasks[0].id)).toBeUndefined();
  });

  it('rolls back optimistic delete when DELETE fails', async () => {
    server.use(
      http.delete(`${API}/:id`, () => HttpResponse.json({ message: 'Error' }, { status: 500 })),
    );

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.deleteTask(defaultTasks[0].id);
    });

    // Task should be restored
    expect(result.current.tasks.find((t) => t.id === defaultTasks[0].id)).toBeDefined();
  });

  // ─── createTask ───────────────────────────────────────────────────────────

  it('sends POST and prepends the new task to the list', async () => {
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const beforeCount = result.current.tasks.length;

    await act(async () => {
      await result.current.createTask('Brand new task');
    });

    expect(result.current.tasks.length).toBe(beforeCount + 1);
    expect(result.current.tasks[0].title).toBe('Brand new task');
  });

  // ─── createTask — priority in POST body ───────────────────────────────────

  it('toggle() does nothing when the task id is not in the list', async () => {
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const snapshot = result.current.tasks;

    await act(async () => {
      await result.current.toggle(9999);
    });

    expect(result.current.tasks).toEqual(snapshot);
  });

  it('createTask() throws when the POST request fails', async () => {
    server.use(
      http.post(API, () => HttpResponse.json({ message: 'Server error' }, { status: 500 })),
    );

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => { await result.current.createTask('Will fail'); }),
    ).rejects.toThrow('Failed to create task');
  });

  it('includes priority in the POST body when priority is provided', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post(API, async ({ request }) => {
        capturedBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(
          { id: 99, title: 'Buy milk', description: null, completed: false, createdAt: new Date().toISOString(), priority: 'High' },
          { status: 201 },
        );
      }),
    );

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createTask('Buy milk', undefined, 'High');
    });

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.priority).toBe('High');
  });

  it('omits priority from the POST body when priority is not provided', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post(API, async ({ request }) => {
        capturedBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(
          { id: 99, title: 'Buy milk', description: null, completed: false, createdAt: new Date().toISOString(), priority: 'Medium' },
          { status: 201 },
        );
      }),
    );

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createTask('Buy milk');
    });

    expect(capturedBody).not.toBeNull();
    expect(Object.prototype.hasOwnProperty.call(capturedBody, 'priority')).toBe(false);
  });

  // ─── priority filter — GET URL ────────────────────────────────────────────

  it('appends ?priority=Low to the GET request when priority filter is Low', async () => {
    let capturedUrl: string | null = null;
    server.use(
      http.get(API, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: defaultTasks,
          meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
        });
      }),
    );

    const { result } = renderHook(() => useTasks('Low'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(capturedUrl).not.toBeNull();
    expect(new URL(capturedUrl!).searchParams.get('priority')).toBe('Low');
  });

  it('sets isLoading to true while re-fetching after a filter change', async () => {
    const { result, rerender } = renderHook(
      ({ priority }: { priority: 'High' | 'Medium' | 'Low' | undefined }) => useTasks(priority),
      { initialProps: { priority: undefined } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ priority: 'Low' });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('re-fetches with ?priority=High when filter changes from Low to High', async () => {
    const capturedUrls: string[] = [];
    server.use(
      http.get(API, ({ request }) => {
        capturedUrls.push(request.url);
        return HttpResponse.json({
          data: defaultTasks,
          meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
        });
      }),
    );

    const { result, rerender } = renderHook(
      ({ priority }: { priority: 'High' | 'Medium' | 'Low' | undefined }) => useTasks(priority),
      { initialProps: { priority: 'Low' as const } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ priority: 'High' });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const lastUrl = capturedUrls[capturedUrls.length - 1];
    expect(new URL(lastUrl).searchParams.get('priority')).toBe('High');
  });
});
