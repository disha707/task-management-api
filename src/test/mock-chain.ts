import { vi } from 'vitest';

/**
 * Creates a thenable mock that is also chainable.
 * Drizzle uses builder chains; awaiting any step in the chain resolves to `value`.
 *
 * The method list is the full superset used across tasks and auth tests:
 *   - tasks tests use: from, where, orderBy, limit, offset, values, set, returning
 *   - auth tests use:  from, where, values, returning
 */
export function mockChain(value: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const p = Promise.resolve(value) as any;
  const methods = [
    'from',
    'where',
    'orderBy',
    'limit',
    'offset',
    'values',
    'set',
    'returning',
    'groupBy',
  ];
  for (const m of methods) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    p[m] = vi.fn().mockReturnValue(p);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return p;
}
