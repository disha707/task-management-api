/**
 * Integration tests for AuthService + PostgreSQL.
 *
 * Scope:
 *   Real AuthService, real UsersService, real bcrypt, real JWT signing,
 *   real PostgreSQL. A NestJS TestingModule resolves all dependencies.
 *   Each test creates its own user and the afterEach cleans up by email.
 *
 * Coverage:
 *   - register: inserts a user row and returns a signed JWT
 *   - register: throws ConflictException on duplicate email
 *   - login: returns a signed JWT for correct credentials
 *   - login: throws UnauthorizedException for wrong password
 *   - login: throws UnauthorizedException for unknown email
 *   - The returned JWT decodes to the correct sub and email claims
 *
 * What is NOT covered:
 *   - HTTP layer (status codes, ValidationPipe) — requires a running server
 *   - Controller argument forwarding → auth.controller.unit.spec.ts
 */

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { db } from '../db/db';
import { users } from '../db/schema';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

const TEST_EMAIL_PREFIX = `integ-auth-${Date.now()}`;

describe('AuthService Integration Tests', () => {
  let service: AuthService;
  let jwtService: JwtService;
  const createdEmails: string[] = [];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '1h' } }),
      ],
      providers: [AuthService, UsersService],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(async () => {
    for (const email of createdEmails) {
      await db.delete(users).where(eq(users.email, email));
    }
    createdEmails.length = 0;
  });

  function uniqueEmail(suffix: string) {
    const email = `${TEST_EMAIL_PREFIX}-${suffix}@example.com`;
    createdEmails.push(email);
    return email;
  }

  // ─── register ─────────────────────────────────────────────────────────────

  describe('register', () => {
    it('creates a user in the database and returns a signed JWT', async () => {
      const email = uniqueEmail('register-ok');

      const result = await service.register({ email, password: 'securepass' });

      expect(result).toHaveProperty('access_token');
      const payload = jwtService.verify(result.access_token);
      expect(payload.email).toBe(email);
      expect(typeof payload.sub).toBe('number');
    });

    it('throws ConflictException when email is already registered', async () => {
      const email = uniqueEmail('register-conflict');
      await service.register({ email, password: 'securepass' });

      await expect(
        service.register({ email, password: 'anotherpass' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns a signed JWT for valid credentials', async () => {
      const email = uniqueEmail('login-ok');
      await service.register({ email, password: 'securepass' });

      const result = await service.login({ email, password: 'securepass' });

      expect(result).toHaveProperty('access_token');
      const payload = jwtService.verify(result.access_token);
      expect(payload.email).toBe(email);
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      const email = uniqueEmail('login-bad-pw');
      await service.register({ email, password: 'securepass' });

      await expect(
        service.login({ email, password: 'wrongpass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for an unknown email', async () => {
      await expect(
        service.login({ email: 'nobody@example.com', password: 'whatever' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
