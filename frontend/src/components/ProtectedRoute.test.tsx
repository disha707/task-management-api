/**
 * Unit tests for ProtectedRoute.
 *
 * Scope:
 *   ProtectedRoute is a routing guard component. These tests verify that it
 *   renders children when the user is authenticated and redirects to /login
 *   when the user is not authenticated. localStorage is manipulated directly
 *   to control the auth state — no network calls needed.
 *
 * Coverage:
 *   - Renders children when a token is present in localStorage
 *   - Redirects to /login when no token is present
 *
 * What is NOT covered:
 *   - Token validation (expiry, signature) — the backend guard handles this
 *   - Login and register forms → LoginPage.test.tsx, RegisterPage.test.tsx
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, beforeEach } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';

function renderWithRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>Protected content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => localStorage.clear());

  it('renders children when user is authenticated', () => {
    localStorage.setItem('auth_token', 'valid-token');

    renderWithRouter('/');

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('redirects to /login when user is not authenticated', () => {
    renderWithRouter('/');

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
});
