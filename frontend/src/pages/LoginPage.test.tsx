/**
 * Unit tests for LoginPage.
 *
 * Scope:
 *   LoginPage is rendered inside a MemoryRouter + AuthProvider so navigation
 *   and auth work without a real browser. Network calls go through MSW.
 *
 * Coverage:
 *   - Renders email input, password input, and submit button
 *   - Shows a validation error when submitted with empty fields
 *   - Shows a server error message when login returns 401
 *   - On success, navigates away from /login (redirects to /)
 *   - Provides a link to the register page
 *
 * What is NOT covered:
 *   - Token storage and isAuthenticated state → AuthContext.test.tsx
 *   - Route protection → ProtectedRoute.test.tsx
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { AUTH_API } from '../mocks/handlers';
import { AuthProvider } from '../context/AuthContext';
import { LoginPage } from './LoginPage';

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Home page</div>} />
          <Route path="/register" element={<div>Register page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  it('renders email, password inputs and a submit button', () => {
    renderLoginPage();

    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows a validation error when submitted with empty fields', async () => {
    renderLoginPage();

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows a server error when login returns 401', async () => {
    server.use(
      http.post(`${AUTH_API}/login`, () =>
        HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 }),
      ),
    );
    renderLoginPage();

    await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('navigates to home on successful login', async () => {
    renderLoginPage();

    await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Home page')).toBeInTheDocument();
    });
  });

  it('has a link to the register page', () => {
    renderLoginPage();

    expect(screen.getByRole('link', { name: /register/i })).toBeInTheDocument();
  });
});
