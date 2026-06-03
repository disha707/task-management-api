/**
 * Unit tests for AuthController — Mockist (London) style.
 *
 * Approach:
 *   AuthService is replaced entirely by a mock object. Tests verify
 *   INTERACTIONS: that each handler calls the correct service method,
 *   forwards its arguments unchanged, and returns whatever the service
 *   returns — without exercising any real service logic.
 *
 *   Contrast with auth.controller.unit.spec.ts (Classical):
 *   - Classical wires real AuthService + real UsersService + mocked db.
 *     Asserts on returned tokens and thrown exceptions.
 *   - Mockist mocks AuthService entirely and asserts which methods were
 *     called with which arguments.
 *
 *   Trade-offs of the mockist approach:
 *   + Completely isolated — breaks on mismatched method signatures, not
 *     on underlying service or DB bugs.
 *   + Pinpoints controller-layer bugs precisely.
 *   - Tests couple to method names; renaming authService.register breaks
 *     the test even if behaviour is unchanged.
 *   - Does not catch wiring bugs where the controller calls the wrong
 *     service method with a plausible name.
 *
 * Coverage:
 *   - register: delegates to authService.register with the body DTO
 *   - register: returns exactly what authService.register returns (pass-through)
 *   - login: delegates to authService.login with the body DTO
 *   - login: returns exactly what authService.login returns (pass-through)
 *   - register: does not call authService.login
 *   - login: does not call authService.register
 */

import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const mockAuthService = {
  register: vi.fn(),
  login: vi.fn(),
};

describe('AuthController Unit Tests (Mockist)', () => {
  let controller: AuthController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  // ─── register ─────────────────────────────────────────────────────────────

  describe('register', () => {
    it('calls authService.register with the body DTO and returns the result', async () => {
      const dto: RegisterDto = { email: 'alice@example.com', password: 'password123' };
      const serviceResult = { access_token: 'signed-token' };
      mockAuthService.register.mockResolvedValue(serviceResult);

      const result = await controller.register(dto);

      expect(mockAuthService.register).toHaveBeenCalledOnce();
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toBe(serviceResult);
    });

    it('does not call authService.login', async () => {
      mockAuthService.register.mockResolvedValue({ access_token: 'token' });

      await controller.register({ email: 'alice@example.com', password: 'password123' });

      expect(mockAuthService.login).not.toHaveBeenCalled();
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('calls authService.login with the body DTO and returns the result', async () => {
      const dto: LoginDto = { email: 'alice@example.com', password: 'password123' };
      const serviceResult = { access_token: 'signed-token' };
      mockAuthService.login.mockResolvedValue(serviceResult);

      const result = await controller.login(dto);

      expect(mockAuthService.login).toHaveBeenCalledOnce();
      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
      expect(result).toBe(serviceResult);
    });

    it('does not call authService.register', async () => {
      mockAuthService.login.mockResolvedValue({ access_token: 'token' });

      await controller.login({ email: 'alice@example.com', password: 'password123' });

      expect(mockAuthService.register).not.toHaveBeenCalled();
    });
  });
});
