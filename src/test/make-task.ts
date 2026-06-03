/**
 * Factory for creating task objects in tests.
 * Used by tasks service and controller tests.
 */
export const makeTask = (overrides = {}) => ({
  id: 1,
  title: 'Test task',
  description: null as string | null,
  completed: false,
  createdAt: new Date('2024-01-01'),
  priority: 'Medium' as 'High' | 'Medium' | 'Low',
  ...overrides,
});
