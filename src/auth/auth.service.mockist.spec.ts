/**
 * Unit tests for AuthService — Mockist (London) style.
 *
 * Approach:
 *   UsersService and JwtService are replaced by mock objects. Tests verify
 *   INTERACTIONS: that register and login call the correct collaborators,
 *   forward the right arguments, and return whatever the collaborators return.
 *
 *   Contrast with auth.service.unit.spec.ts (Classical):
 *   - Classical wires real UsersService + real JwtService (test secret) + mocked db.
 *     Asserts on the shape of the returned token.
 *   - Mockist mocks all collaborators and asserts which methods were called
 *     with which arguments.
 *
 *   Trade-offs of the mockist approach:
 *   + Completely isolated — fails fast on signature mismatches.
 *   + Pinpoints AuthService-layer bugs without running UsersService or JwtService logic.
 *   - Couples tests to method names; renaming usersService.findByEmail breaks
 *     the test even if behaviour is unchanged.
 *   - Does not verify that the JWT payload is correctly structured.
 *
 * Coverage:
 *   - register: calls usersService.findByEmail with the provided email
 *   - register: calls bcrypt.hash with (password, 10) when email is available
 *   - register: calls usersService.create with (email, hashedPassword)
 *   - register: calls jwtService.sign with { sub, email } and returns access_token
 *   - register: throws ConflictException without calling bcrypt or usersService.create
 *     when email is already taken
 *   - login: calls usersService.findByEmail with the provided email
 *   - login: calls bcrypt.compare with (password, passwordHash)
 *   - login: calls jwtService.sign and returns access_token on valid credentials
 *   - login: throws UnauthorizedException without calling bcrypt when user not found
 *   - login: throws UnauthorizedException without calling jwtService.sign on bad password
 */

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';

const mockUsersService = {
  findByEmail: vi.fn(),
  create: vi.fn(),
};

const mockJwtService = {
  sign: vi.fn(),
};

const storedUser = {
  id: 1,
  email: 'alice@example.com',
  passwordHash: 'hashed-pw',
  createdAt: new Date(),
};

describe('AuthService Unit Tests (Mockist)', () => {
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─── register ─────────────────────────────────────────────────────────────

  describe('register', () => {
    it('calls usersService.findByEmail with the provided email', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-pw');
      mockUsersService.create.mockResolvedValue(storedUser);
      mockJwtService.sign.mockReturnValue('signed-token');

      await service.register({
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(mockUsersService.findByEmail).toHaveBeenCalledOnce();
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        'alice@example.com',
      );
    });

    it('calls bcrypt.hash with (password, 10)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-pw');
      mockUsersService.create.mockResolvedValue(storedUser);
      mockJwtService.sign.mockReturnValue('signed-token');

      await service.register({
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(bcrypt.hash).toHaveBeenCalledOnce();
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });

    it('calls usersService.create with (email, hashedPassword)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-pw');
      mockUsersService.create.mockResolvedValue(storedUser);
      mockJwtService.sign.mockReturnValue('signed-token');

      await service.register({
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(mockUsersService.create).toHaveBeenCalledOnce();
      expect(mockUsersService.create).toHaveBeenCalledWith(
        'alice@example.com',
        'hashed-pw',
      );
    });

    it('calls jwtService.sign with { sub, email } and returns the token', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-pw');
      mockUsersService.create.mockResolvedValue(storedUser);
      mockJwtService.sign.mockReturnValue('signed-token');

      const result = await service.register({
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(mockJwtService.sign).toHaveBeenCalledOnce();
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: storedUser.id,
        email: storedUser.email,
      });
      expect(result).toEqual({ access_token: 'signed-token' });
    });

    it('throws ConflictException without calling bcrypt.hash or usersService.create', async () => {
      mockUsersService.findByEmail.mockResolvedValue(storedUser);

      await expect(
        service.register({
          email: 'alice@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(mockUsersService.create).not.toHaveBeenCalled();
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('calls usersService.findByEmail with the provided email', async () => {
      mockUsersService.findByEmail.mockResolvedValue(storedUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('signed-token');

      await service.login({
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(mockUsersService.findByEmail).toHaveBeenCalledOnce();
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        'alice@example.com',
      );
    });

    it('calls bcrypt.compare with (password, passwordHash)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(storedUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('signed-token');

      await service.login({
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(bcrypt.compare).toHaveBeenCalledOnce();
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        storedUser.passwordHash,
      );
    });

    it('calls jwtService.sign and returns the token on valid credentials', async () => {
      mockUsersService.findByEmail.mockResolvedValue(storedUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('signed-token');

      const result = await service.login({
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(mockJwtService.sign).toHaveBeenCalledOnce();
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: storedUser.id,
        email: storedUser.email,
      });
      expect(result).toEqual({ access_token: 'signed-token' });
    });

    it('throws UnauthorizedException without calling bcrypt.compare when user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException without calling jwtService.sign when password is wrong', async () => {
      mockUsersService.findByEmail.mockResolvedValue(storedUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false);

      await expect(
        service.login({
          email: 'alice@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });
  });
});
