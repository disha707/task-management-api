/**
 * Integration tests for the App component.
 *
 * Scope:
 *   These tests exercise the full component tree (App → AuthProvider →
 *   ProtectedRoute → TasksPage → useTasks → CreateTaskForm → TaskList)
 *   against MSW-intercepted network calls.
 *   A valid token is seeded into localStorage so ProtectedRoute lets us
 *   through without needing to fill in the login form.
 *
 * Coverage:
 *   - Unauthenticated visit shows the login page
 *   - Authenticated visit shows the task list (loading → loaded)
 *   - Adding a task via the form prepends it to the list
 *   - Toggling a task's checkbox flips its completed badge (optimistic)
 *   - Deleting a task removes it from the list (optimistic)
 *   - Sign out clears the session and redirects to /login
 *
 * What is NOT covered:
 *   - Hook state transitions → useTasks.test.tsx
 *   - Form validation → CreateTaskForm.test.tsx
 *   - Auth context state → AuthContext.test.tsx
 *   - Individual card rendering → Task.test.tsx
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { API, defaultTasks } from './mocks/handlers';
import { server } from './mocks/server';

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('redirects unauthenticated visitors to /login', () => {
    renderApp();

    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows loading skeleton then tasks for authenticated users', async () => {
    localStorage.setItem('auth_token', 'valid-token');
    renderApp();

    expect(screen.getByTestId('task-list-loading')).toBeInTheDocument();
    expect(await screen.findByText('First task')).toBeInTheDocument();
    expect(screen.getByText('Second task')).toBeInTheDocument();
  });

  it('prepends a new task to the list after form submission', async () => {
    localStorage.setItem('auth_token', 'valid-token');
    renderApp();
    await screen.findByText('First task');

    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'Brand new task');
    await userEvent.click(screen.getByRole('button', { name: /add task/i }));

    await waitFor(() => expect(screen.getByText('Brand new task')).toBeInTheDocument());
  });

  it('flips the completed badge when checkbox is toggled (optimistic)', async () => {
    localStorage.setItem('auth_token', 'valid-token');
    renderApp();
    await screen.findByText('First task');

    const firstCard = screen.getByText('First task').closest('div')!;
    expect(within(firstCard).getByText('Incomplete')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('checkbox')[0]);

    await waitFor(() => {
      expect(within(firstCard).getByText('Completed')).toBeInTheDocument();
    });
  });

  it('removes a task from the list after delete (optimistic)', async () => {
    localStorage.setItem('auth_token', 'valid-token');
    renderApp();
    await screen.findByText('First task');

    await userEvent.click(screen.getAllByRole('button', { name: /delete/i })[0]);

    await waitFor(() => {
      expect(screen.queryByText(defaultTasks[0].title)).not.toBeInTheDocument();
    });
  });

  it('shows an error alert when the API returns 500', async () => {
    localStorage.setItem('auth_token', 'valid-token');
    server.use(http.get(API, () => HttpResponse.json({}, { status: 500 })));
    renderApp();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('redirects to /login after signing out', async () => {
    localStorage.setItem('auth_token', 'valid-token');
    renderApp();
    await screen.findByText('First task');

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
  });
});
