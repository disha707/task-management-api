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
});
