/**
 * Unit tests for RegisterPage.
 *
 * Scope:
 *   RegisterPage is rendered inside MemoryRouter + AuthProvider.
 *   Network calls go through MSW.
 *
 * Coverage:
 *   - Renders email, password, and confirm-password inputs
 *   - Shows a validation error when passwords do not match
 *   - Shows a server error when the email is already taken (409)
 *   - Navigates to home on successful registration
 *   - Has a link back to the login page
 *
 * What is NOT covered:
 *   - Token storage → AuthContext.test.tsx
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { AUTH_API } from '../mocks/handlers';
import { AuthProvider } from '../context/AuthContext';
import { RegisterPage } from './RegisterPage';

function renderRegisterPage() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<div>Home page</div>} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('RegisterPage', () => {
  it('renders email, password, and confirm-password inputs', () => {
    renderRegisterPage();

    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows a validation error when passwords do not match', async () => {
    renderRegisterPage();

    await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'new@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'password123');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'different456');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows a server error when email is already taken', async () => {
    server.use(
      http.post(`${AUTH_API}/register`, () =>
        HttpResponse.json({ message: 'Email already registered' }, { status: 409 }),
      ),
    );
    renderRegisterPage();

    await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'taken@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'password123');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('navigates to home on successful registration', async () => {
    renderRegisterPage();

    await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'new@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'password123');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Home page')).toBeInTheDocument();
    });
  });

  it('has a link back to the login page', () => {
    renderRegisterPage();

    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });
});
