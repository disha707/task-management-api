/**
 * E2E tests for the Auth HTTP layer.
 *
 * Scope:
 *   Full NestJS pipeline: ValidationPipe, guards, controllers, services, real DB.
 *   Tests assert on HTTP status codes and response shapes — what an API client sees.
 *
 * Coverage:
 *   Register:
 *   - valid credentials → 201 with access_token
 *   - invalid email format → 400
 *   - password shorter than 8 chars → 400
 *   - duplicate email → 409
 *
 *   Login:
 *   - valid credentials → 200 with access_token
 *   - wrong password → 401
 *   - unknown email → 401
 *   - missing request body fields → 400
 */

import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { AppModule } from '../app.module';
import { db } from '../db/db';
import { users } from '../db/schema';

const EMAIL_PREFIX = `e2e-auth-${Date.now()}`;

function uniqueEmail(suffix: string) {
  return `${EMAIL_PREFIX}-${suffix}@test.com`;
}

describe('Auth E2E', () => {
  let app: INestApplication;
  const createdEmails: string[] = [];

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    for (const email of createdEmails) {
      await db.delete(users).where(eq(users.email, email));
    }
    await app.close();
  });

  function trackEmail(email: string) {
    createdEmails.push(email);
    return email;
  }

  // ─── POST /auth/register ──────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('returns 201 with access_token for valid credentials', async () => {
      const email = trackEmail(uniqueEmail('register-ok'));

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'securepass' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('access_token');
      expect(typeof res.body.access_token).toBe('string');
    });

    it('returns 400 when email format is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'securepass' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when password is shorter than 8 characters', async () => {
      const email = uniqueEmail('register-short-pw');

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'short' });

      expect(res.status).toBe(400);
    });

    it('returns 409 when email is already registered', async () => {
      const email = trackEmail(uniqueEmail('register-conflict'));

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'securepass' });

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'anotherpass' });

      expect(res.status).toBe(409);
    });
  });

  // ─── POST /auth/login ─────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    const loginEmail = uniqueEmail('login-user');

    beforeAll(async () => {
      trackEmail(loginEmail);
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: loginEmail, password: 'securepass' });
    });

    it('returns 200 with access_token for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: loginEmail, password: 'securepass' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
      expect(typeof res.body.access_token).toBe('string');
    });

    it('returns 401 when password is wrong', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: loginEmail, password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });

    it('returns 401 when email does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'unknown@test.com', password: 'securepass' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when request body fields are missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
