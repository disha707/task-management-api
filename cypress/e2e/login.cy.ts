/**
 * Smoke test: login flow.
 *
 * WHY CYPRESS INSTEAD OF VITEST?
 * ─────────────────────────────────────────────────────────────────────────────
 * Vitest (component tests) runs in Node + jsdom. It cannot test:
 *   - Real browser navigation and history (pushState, back button)
 *   - localStorage persistence across page reloads in a real browser session
 *   - CSS-driven visibility (display:none, opacity)
 *   - Network requests sent by the actual browser (not a simulated env)
 *
 * Cypress runs a real browser, so it catches regressions that jsdom misses.
 * The trade-off: slower (seconds per test vs milliseconds), needs a running
 * app, and can be flakier on CI if not given proper wait conditions.
 *
 * WHEN TO WRITE CYPRESS TESTS (and when NOT to):
 *   ✅ Critical user journeys (login → tasks → create → logout)
 *   ✅ Flows that cross page boundaries (redirect after login)
 *   ✅ Anything involving real cookies/localStorage across navigations
 *   ❌ Don't rewrite every unit test as a Cypress test — that's slow and redundant
 *   ❌ Don't use Cypress for pure business-logic assertions (use unit tests)
 *
 * STRATEGY — api mocking with cy.intercept():
 *   The backend does not need to run for these tests. cy.intercept() stubs
 *   the HTTP calls so tests are fast, deterministic, and CI-friendly.
 *   Reserve tests that hit the REAL backend for staging/QA pipelines.
 */

const TOKEN = 'smoke-test-jwt';

describe('Login flow', () => {
  beforeEach(() => {
    // Stub the API so no backend is needed
    cy.intercept('POST', '/auth/login', { access_token: TOKEN }).as('login');
    cy.intercept('GET', '/tasks*', {
      data: [
        { id: 1, title: 'First task', completed: false, priority: 'Medium', description: null, createdAt: '2024-01-01T00:00:00.000Z' },
      ],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    }).as('getTasks');
  });

  it('redirects to the tasks page after a successful login', () => {
    cy.visit('/login');

    cy.get('input[aria-label="Email"]').type('user@example.com');
    cy.get('input[aria-label="Password"]').type('password123');
    cy.get('button[type="submit"]').click();

    cy.wait('@login');
    cy.url().should('eq', Cypress.config('baseUrl') + '/');
  });

  it('shows a task on the tasks page after login', () => {
    cy.visit('/login');

    cy.get('input[aria-label="Email"]').type('user@example.com');
    cy.get('input[aria-label="Password"]').type('password123');
    cy.get('button[type="submit"]').click();

    cy.wait('@login');
    cy.wait('@getTasks');
    cy.contains('First task').should('be.visible');
  });

  it('shows an error message when credentials are wrong', () => {
    cy.intercept('POST', '/auth/login', {
      statusCode: 401,
      body: { message: 'Invalid credentials' },
    }).as('failedLogin');

    cy.visit('/login');

    cy.get('input[aria-label="Email"]').type('user@example.com');
    cy.get('input[aria-label="Password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();

    cy.wait('@failedLogin');
    cy.get('[role="alert"]').should('be.visible');
  });
});
