/**
 * Tests for TasksPage — priority filter strip behavior.
 *
 * Scope:
 *   Verifies that the filter strip renders correctly, tracks active state via
 *   aria-pressed, and that clicking buttons updates the active filter. Network
 *   calls go through MSW. Auth token is seeded in localStorage so useTasks
 *   can fetch without redirecting.
 *
 * Coverage:
 *   - Filter strip renders all four buttons (All, High, Medium, Low)
 *   - "All" has aria-pressed="true" on initial render
 *   - Clicking "High" activates "High" and deactivates "All"
 *   - Clicking "All" after "High" is active resets to "All" being active
 *
 * What is NOT covered:
 *   - Network filtering (verifying the URL carries ?priority=High) → useTasks.test.tsx
 *   - Task card rendering → Task.test.tsx
 *   - Form submission → CreateTaskForm.test.tsx
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { API, defaultTasks } from '../mocks/handlers';
import { AuthProvider } from '../context/AuthContext';
import { TasksPage } from './TasksPage';

function renderTasksPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TasksPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.setItem('auth_token', 'valid-token');
  // Override the default GET handler to also accept ?priority=* query params
  // so filter button clicks don't trigger "unhandled request" errors from MSW.
  server.use(
    http.get(API, () =>
      HttpResponse.json({
        data: defaultTasks,
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      }),
    ),
  );
});

afterEach(() => {
  localStorage.removeItem('auth_token');
});

describe('TasksPage — priority filter strip', () => {
  it('renders four filter buttons: All, High, Medium, Low', async () => {
    renderTasksPage();

    // Wait for the page to finish loading so the filter strip is visible
    await screen.findByText('First task');

    const group = screen.getByRole('group', { name: /filter by priority/i });
    const buttons = group.querySelectorAll('button');

    expect(buttons).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'High' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Medium' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Low' })).toBeInTheDocument();
  });

  it('"All" has aria-pressed="true" and the other buttons have aria-pressed="false" on initial render', async () => {
    renderTasksPage();

    await screen.findByText('First task');

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'High' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Low' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking "High" sets aria-pressed="true" on "High" and "false" on "All"', async () => {
    renderTasksPage();

    await screen.findByText('First task');

    await userEvent.click(screen.getByRole('button', { name: 'High' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'High' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking "Medium" sets aria-pressed="true" on "Medium" and "false" on "All"', async () => {
    renderTasksPage();

    await screen.findByText('First task');

    await userEvent.click(screen.getByRole('button', { name: 'Medium' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking "Low" sets aria-pressed="true" on "Low" and "false" on "All"', async () => {
    renderTasksPage();

    await screen.findByText('First task');

    await userEvent.click(screen.getByRole('button', { name: 'Low' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Low' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking "All" after "High" is active resets aria-pressed="true" back to "All"', async () => {
    renderTasksPage();

    await screen.findByText('First task');

    await userEvent.click(screen.getByRole('button', { name: 'High' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'High' })).toHaveAttribute('aria-pressed', 'true'),
    );

    await userEvent.click(screen.getByRole('button', { name: 'All' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'High' })).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
