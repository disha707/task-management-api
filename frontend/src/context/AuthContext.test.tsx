/**
 * Unit tests for AuthContext.
 *
 * Scope:
 *   These tests verify the auth state machine exposed by AuthContext:
 *   initial unauthenticated state, login, logout, and register.
 *   Network calls are intercepted by MSW.
 *   localStorage is cleared before each test to ensure isolation.
 *
 * Coverage:
 *   - isAuthenticated is false and token is null on a fresh mount
 *   - login() fetches a token, stores it in localStorage, and sets
 *     isAuthenticated to true
 *   - login() throws when the server returns 401
 *   - register() fetches a token and sets isAuthenticated to true
 *   - register() throws when the server returns 409 (email taken)
 *   - logout() clears the token and sets isAuthenticated to false
 *   - AuthContext restores session from localStorage on mount
 *
 * What is NOT covered:
 *   - Page-level rendering and form interaction → LoginPage.test.tsx
 *   - Route protection → ProtectedRoute.test.tsx
 */

import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { AUTH_API, FAKE_TOKEN } from '../mocks/handlers';
import { AuthProvider, useAuth } from './AuthContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthContext', () => {
  beforeEach(() => localStorage.clear());

  it('starts unauthenticated with no token', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
  });

  it('login() stores token and sets isAuthenticated to true', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('user@example.com', 'password123');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe(FAKE_TOKEN);
    expect(localStorage.getItem('auth_token')).toBe(FAKE_TOKEN);
  });

  it('login() throws when server returns 401', async () => {
    server.use(
      http.post(`${AUTH_API}/login`, () =>
        HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 }),
      ),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(
      act(async () => { await result.current.login('x@x.com', 'wrong'); }),
    ).rejects.toThrow();

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('register() stores token and sets isAuthenticated to true', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.register('new@example.com', 'password123');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe(FAKE_TOKEN);
  });

  it('register() throws when server returns 409 (email taken)', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(
      act(async () => { await result.current.register('taken@example.com', 'password123'); }),
    ).rejects.toThrow();

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('logout() clears token and sets isAuthenticated to false', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('user@example.com', 'password123');
    });

    act(() => result.current.logout());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('restores session from localStorage on mount', () => {
    localStorage.setItem('auth_token', FAKE_TOKEN);

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe(FAKE_TOKEN);
  });

  it('useAuth throws when used outside AuthProvider', () => {
    // Suppress React's error boundary output in test logs
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<div>{(() => { useAuth(); return null; })()}</div>)).toThrow();
    spy.mockRestore();
  });
});
