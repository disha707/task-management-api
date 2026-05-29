/**
 * Unit tests for AuthService — Classical (Detroit) style.
 *
 * Scope:
 *   Real AuthService + real UsersService are wired together.
 *   The database (external boundary) is replaced by a mock.
 *   bcrypt is mocked because it is intentionally slow and its correctness
 *   is the library's responsibility, not ours — we only verify we call it
 *   with the right arguments and honour its return value.
 *   JwtService runs with a test secret so token signing is real.
 *
 * Coverage:
 *   - register: hashes the password, inserts the user, returns an access_token
 *   - register: throws ConflictException when email is already taken
 *   - login: returns an access_token when credentials are valid
 *   - login: throws UnauthorizedException for an unknown email
 *   - login: throws UnauthorizedException for a wrong password
 *
 * What is NOT covered:
 *   - Real DB persistence → auth.service.integration.spec.ts
 *   - HTTP layer (status codes, validation pipes) → same file
 */

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

import * as bcrypt from 'bcrypt';
import { db } from '../db/db';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

function mockChain(value: unknown) {
  const p = Promise.resolve(value) as any;
  ['from', 'where', 'values', 'returning'].forEach((m) => {
    p[m] = vi.fn().mockReturnValue(p);
  });
  return p;
}

const existingUser = {
  id: 1,
  email: 'alice@example.com',
  passwordHash: 'hashed-pw',
  createdAt: new Date(),
};

describe('AuthService Unit Tests (Classical)', () => {
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '1h' } }),
      ],
      providers: [AuthService, UsersService],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─── register ─────────────────────────────────────────────────────────────

  describe('register', () => {
    it('hashes the password and returns an access_token', async () => {
      (db.select as any).mockReturnValue(mockChain([])); // email not taken
      (bcrypt.hash as any).mockResolvedValue('hashed-pw');
      (db.insert as any).mockReturnValue(mockChain([existingUser]));

      const result = await service.register({ email: 'alice@example.com', password: 'password123' });

      expect(result).toHaveProperty('access_token');
      expect(typeof result.access_token).toBe('string');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });

    it('throws ConflictException when email is already registered', async () => {
      (db.select as any).mockReturnValue(mockChain([existingUser]));

      await expect(
        service.register({ email: 'alice@example.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns an access_token for valid credentials', async () => {
      (db.select as any).mockReturnValue(mockChain([existingUser]));
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await service.login({ email: 'alice@example.com', password: 'password123' });

      expect(result).toHaveProperty('access_token');
      expect(typeof result.access_token).toBe('string');
    });

    it('throws UnauthorizedException for an unknown email', async () => {
      (db.select as any).mockReturnValue(mockChain([]));

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      (db.select as any).mockReturnValue(mockChain([existingUser]));
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(
        service.login({ email: 'alice@example.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
