/**
 * Unit tests for UsersService — Classical (Detroit) style.
 *
 * Scope:
 *   The Drizzle `db` object is replaced by a mock, so no real PostgreSQL
 *   connection is made.  Tests assert on return values — the observable
 *   behaviour from the caller's perspective.
 *
 * Coverage:
 *   - findByEmail: returns the matching user when found
 *   - findByEmail: returns undefined when no user exists for the given email
 *   - create: inserts a user and returns the newly created row
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

describe('UsersService Unit Tests (Classical)', () => {
  let service: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UsersService();
  });

  // ─── findByEmail ──────────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('returns the user when the email exists in the database', async () => {
      (db.select as any).mockReturnValue(mockChain([storedUser]));

      const result = await service.findByEmail('alice@example.com');

      expect(result).toEqual(storedUser);
    });

    it('returns undefined when no user matches the email', async () => {
      (db.select as any).mockReturnValue(mockChain([]));

      const result = await service.findByEmail('nobody@example.com');

      expect(result).toBeUndefined();
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('inserts a user and returns the newly created row', async () => {
      (db.insert as any).mockReturnValue(mockChain([storedUser]));

      const result = await service.create('alice@example.com', 'hashed-pw');

      expect(result).toEqual(storedUser);
    });
  });
});
