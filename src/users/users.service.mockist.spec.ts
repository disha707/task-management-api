/**
 * Unit tests for UsersService — Mockist (London) style.
 *
 * Approach:
 *   The Drizzle `db` object is mocked and tests verify INTERACTIONS:
 *   that the service calls the correct db methods exactly once.
 *
 *   Contrast with users.service.unit.spec.ts (Classical):
 *   - Classical mocks db and asserts on return values.
 *   - Mockist mocks db and asserts on which methods were called and how many times.
 *
 *   Trade-offs of the mockist approach:
 *   + Pinpoints exactly which db operation the service invokes.
 *   - Tightly coupled to the implementation; internal refactors can break tests
 *     with no user impact.
 *
 * Coverage:
 *   - findByEmail: calls db.select exactly once
 *   - create: calls db.insert exactly once
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/db', () => ({
  db: { select: vi.fn(), insert: vi.fn() },
}));

import { db } from '../db/db';
import { UsersService } from './users.service';
import { mockChain } from '../test/mock-chain';

const storedUser = {
  id: 1,
  email: 'alice@example.com',
  passwordHash: 'hashed-pw',
  createdAt: new Date(),
};

describe('UsersService Unit Tests (Mockist)', () => {
  let service: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UsersService();
  });

  // ─── findByEmail ──────────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('calls db.select exactly once', async () => {
      (db.select as any).mockReturnValue(mockChain([storedUser]));

      await service.findByEmail('alice@example.com');

      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it('does not call db.insert when looking up a user', async () => {
      (db.select as any).mockReturnValue(mockChain([]));

      await service.findByEmail('nobody@example.com');

      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('calls db.insert exactly once', async () => {
      (db.insert as any).mockReturnValue(mockChain([storedUser]));

      await service.create('alice@example.com', 'hashed-pw');

      expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it('does not call db.select when creating a user', async () => {
      (db.insert as any).mockReturnValue(mockChain([storedUser]));

      await service.create('alice@example.com', 'hashed-pw');

      expect(db.select).not.toHaveBeenCalled();
    });
  });
});
