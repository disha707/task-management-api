/**
 * Unit tests for AuthController — Classical (Detroit) style.
 *
 * Scope:
 *   Real AuthController + real AuthService + real UsersService.
 *   Only the database and bcrypt (external boundaries) are mocked.
 *   JwtService runs with a test secret.
 *   Assertions verify outcomes (returned tokens, thrown exceptions),
 *   not which internal methods were called.
 *
 * Coverage:
 *   - POST /auth/register returns an access_token for a new email
 *   - POST /auth/register throws ConflictException for a duplicate email
 *   - POST /auth/login returns an access_token for valid credentials
 *   - POST /auth/login throws UnauthorizedException for bad credentials
 *
 * What is NOT covered:
 *   - Real DB persistence → auth.service.integration.spec.ts
 *   - HTTP validation (ValidationPipe, status codes) → same file
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
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

function mockChain(value: unknown) {
  const p = Promise.resolve(value) as any;
  ['from', 'where', 'values', 'returning'].forEach((m) => {
    p[m] = vi.fn().mockReturnValue(p);
  });
  return p;
}

const storedUser = { id: 1, email: 'bob@example.com', passwordHash: 'hashed', createdAt: new Date() };

describe('AuthController Unit Tests (Classical)', () => {
  let controller: AuthController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '1h' } }),
      ],
      controllers: [AuthController],
      providers: [AuthService, UsersService],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('register', () => {
    it('returns an access_token for a new email', async () => {
      (db.select as any).mockReturnValue(mockChain([]));
      (bcrypt.hash as any).mockResolvedValue('hashed');
      (db.insert as any).mockReturnValue(mockChain([storedUser]));

      const result = await controller.register({ email: 'bob@example.com', password: 'password123' });

      expect(result).toHaveProperty('access_token');
    });

    it('throws ConflictException when email is already taken', async () => {
      (db.select as any).mockReturnValue(mockChain([storedUser]));

      await expect(
        controller.register({ email: 'bob@example.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns an access_token for valid credentials', async () => {
      (db.select as any).mockReturnValue(mockChain([storedUser]));
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await controller.login({ email: 'bob@example.com', password: 'password123' });

      expect(result).toHaveProperty('access_token');
    });

    it('throws UnauthorizedException for invalid credentials', async () => {
      (db.select as any).mockReturnValue(mockChain([storedUser]));
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(
        controller.login({ email: 'bob@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
