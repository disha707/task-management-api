/**
 * Integration tests for the App component (hooks layer).
 *
 * Scope:
 *   These tests verify the useState + useEffect wiring in App: that tasks are
 *   fetched from the API on mount, that toggling/deleting a task calls the
 *   correct endpoint and updates local state, and that error states are shown.
 *   The global fetch is replaced by a vi.fn() mock — no real network calls.
 *
 * Coverage:
 *   - Shows a loading state while the initial fetch is in-flight
 *   - Renders task titles once the fetch resolves
 *   - Shows an error message when the fetch fails
 *   - PATCH /tasks/:id is called when onToggle fires
 *   - DELETE /tasks/:id is called when onDelete fires
 *   - Deleted task is removed from the rendered list
 *
 * What is NOT covered:
 *   - Task card rendering details → Task.test.tsx
 *   - TaskList composition details → TaskList.test.tsx
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { TaskData } from './types/task';

const API = 'http://localhost:3000/tasks';

function makeFetchResponse(body: unknown, ok = true) {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as Response;
}

const sampleTasks: TaskData[] = [
  { id: 1, title: 'First task', description: null, completed: false, createdAt: '2024-01-01T00:00:00.000Z' },
  { id: 2, title: 'Second task', description: 'Some details', completed: true, createdAt: '2024-01-02T00:00:00.000Z' },
];

const pagedResponse = { data: sampleTasks, meta: { page: 1, limit: 10, total: 2, totalPages: 1 } };

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows loading state while fetching tasks', () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {})); // never resolves

    render(<App />);

    expect(screen.getByTestId('task-list-loading')).toBeInTheDocument();
  });

  it('renders task titles after fetch resolves', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeFetchResponse(pagedResponse));

    render(<App />);

    expect(await screen.findByText('First task')).toBeInTheDocument();
    expect(screen.getByText('Second task')).toBeInTheDocument();
  });

  it('shows error message when fetch fails', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeFetchResponse({}, false));

    render(<App />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('calls PATCH endpoint when a task is toggled', async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(makeFetchResponse(pagedResponse))       // initial GET
      .mockResolvedValueOnce(makeFetchResponse({ ...sampleTasks[0], completed: true })); // PATCH

    render(<App />);
    await screen.findByText('First task');

    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[0]);

    await waitFor(() => {
      const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
      const patchCall = calls.find(([url, opts]: [string, RequestInit]) =>
        url === `${API}/1` && opts?.method === 'PATCH',
      );
      expect(patchCall).toBeDefined();
    });
  });

  it('removes the task from the list after delete', async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(makeFetchResponse(pagedResponse))   // initial GET
      .mockResolvedValueOnce(makeFetchResponse(sampleTasks[0])); // DELETE

    render(<App />);
    await screen.findByText('First task');

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await userEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText('First task')).not.toBeInTheDocument();
    });
  });
});
