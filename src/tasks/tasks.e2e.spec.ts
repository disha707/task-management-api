/**
 * E2E tests for the Tasks HTTP layer.
 *
 * Scope:
 *   Full NestJS pipeline: ValidationPipe, JwtAuthGuard, controllers, services, real DB.
 *   Tests assert on HTTP status codes and response shapes — what an API client sees.
 *
 * Coverage:
 *   Unauthenticated (JWT guard rejects):
 *   - All task endpoints return 401 without an Authorization header
 *
 *   Authenticated — CRUD happy path:
 *   - POST /tasks → 201, response has id, title, completed, priority
 *   - GET /tasks → 200, response has data array and meta object
 *   - GET /tasks/:id → 200, returns the task
 *   - PATCH /tasks/:id with completed → 200, completed is true
 *   - PATCH /tasks/:id with priority → 200, priority is updated
 *   - DELETE /tasks/:id → 200, returns the deleted task
 *
 *   Validation (ValidationPipe):
 *   - POST /tasks with empty body → 400
 *   - POST /tasks with title too short → 400
 *   - PATCH /tasks/:id with invalid priority → 400
 *   - GET /tasks with invalid sortBy → 400
 *
 *   Not found:
 *   - GET /tasks/99999999 → 404
 *   - PATCH /tasks/99999999 → 404
 *   - DELETE /tasks/99999999 → 404
 */

import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';

import { AppModule } from '../app.module';
import { db } from '../db/db';
import { tasks } from '../db/schema';

const EMAIL_PREFIX = `e2e-tasks-${Date.now()}`;
const TEST_USER_EMAIL = `${EMAIL_PREFIX}@test.com`;

describe('Tasks E2E', () => {
  let app: INestApplication;
  let accessToken: string;
  const createdTaskIds: number[] = [];

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: TEST_USER_EMAIL, password: 'securepass' });

    accessToken = res.body.access_token;
  });

  afterAll(async () => {
    if (createdTaskIds.length) {
      await db.delete(tasks).where(inArray(tasks.id, [...createdTaskIds]));
    }
    await app.close();
  });

  function authHeader() {
    return { Authorization: `Bearer ${accessToken}` };
  }

  // ─── GET /tasks/stats ────────────────────────────────────────────────────

  describe('GET /tasks/stats', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app.getHttpServer()).get('/tasks/stats');
      expect(res.status).toBe(401);
    });

    it('returns stats shape with correct keys', async () => {
      const res = await request(app.getHttpServer())
        .get('/tasks/stats')
        .set(authHeader());

      expect(res.status).toBe(200);
      expect(typeof res.body.total).toBe('number');
      expect(typeof res.body.completed).toBe('number');
      expect(typeof res.body.pending).toBe('number');
      expect(res.body.byPriority).toMatchObject({
        High: expect.any(Number),
        Medium: expect.any(Number),
        Low: expect.any(Number),
      });
      expect(res.body.total).toBe(res.body.completed + res.body.pending);
    });
  });

  // ─── Unauthenticated — guard blocks all task routes ───────────────────────

  describe('JWT guard: requests without Authorization header', () => {
    it('GET /tasks → 401', async () => {
      const res = await request(app.getHttpServer()).get('/tasks');
      expect(res.status).toBe(401);
    });

    it('POST /tasks → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/tasks')
        .send({ title: 'Unauthenticated task' });
      expect(res.status).toBe(401);
    });

    it('GET /tasks/1 → 401', async () => {
      const res = await request(app.getHttpServer()).get('/tasks/1');
      expect(res.status).toBe(401);
    });

    it('PATCH /tasks/1 → 401', async () => {
      const res = await request(app.getHttpServer())
        .patch('/tasks/1')
        .send({ completed: true });
      expect(res.status).toBe(401);
    });

    it('DELETE /tasks/1 → 401', async () => {
      const res = await request(app.getHttpServer()).delete('/tasks/1');
      expect(res.status).toBe(401);
    });
  });

  // ─── Authenticated — CRUD happy path ─────────────────────────────────────

  describe('Authenticated CRUD', () => {
    let createdTaskId: number;

    it('POST /tasks with valid body → 201 with task shape', async () => {
      const res = await request(app.getHttpServer())
        .post('/tasks')
        .set(authHeader())
        .send({ title: 'E2E task' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: 'E2E task',
        completed: false,
        priority: 'Medium',
      });
      expect(typeof res.body.id).toBe('number');

      createdTaskId = res.body.id;
      createdTaskIds.push(createdTaskId);
    });

    it('GET /tasks → 200 with data array and meta object', async () => {
      const res = await request(app.getHttpServer())
        .get('/tasks')
        .set(authHeader());

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toMatchObject({
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it('GET /tasks/:id → 200 returns the task', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tasks/${createdTaskId}`)
        .set(authHeader());

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createdTaskId);
      expect(res.body.title).toBe('E2E task');
    });

    it('PATCH /tasks/:id with { completed: true } → 200 with completed = true', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/tasks/${createdTaskId}`)
        .set(authHeader())
        .send({ completed: true });

      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(true);
    });

    it('PATCH /tasks/:id with { priority: "High" } → 200 with priority = High', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/tasks/${createdTaskId}`)
        .set(authHeader())
        .send({ priority: 'High' });

      expect(res.status).toBe(200);
      expect(res.body.priority).toBe('High');
    });

    it('DELETE /tasks/:id → 200 returns the deleted task', async () => {
      const taskToDelete = await request(app.getHttpServer())
        .post('/tasks')
        .set(authHeader())
        .send({ title: 'Task to delete' });

      const taskId = taskToDelete.body.id;

      const res = await request(app.getHttpServer())
        .delete(`/tasks/${taskId}`)
        .set(authHeader());

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(taskId);
    });
  });

  // ─── Validation — ValidationPipe enforces DTO constraints ─────────────────

  describe('Validation', () => {
    it('POST /tasks with empty body → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/tasks')
        .set(authHeader())
        .send({});

      expect(res.status).toBe(400);
    });

    it('POST /tasks with title too short → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/tasks')
        .set(authHeader())
        .send({ title: 'ab' });

      expect(res.status).toBe(400);
    });

    it('PATCH /tasks/:id with invalid priority → 400', async () => {
      const created = await request(app.getHttpServer())
        .post('/tasks')
        .set(authHeader())
        .send({ title: 'Priority validation task' });

      createdTaskIds.push(created.body.id);

      const res = await request(app.getHttpServer())
        .patch(`/tasks/${created.body.id}`)
        .set(authHeader())
        .send({ priority: 'Critical' });

      expect(res.status).toBe(400);
    });

    it('GET /tasks?sortBy=invalid → 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/tasks?sortBy=invalid')
        .set(authHeader());

      expect(res.status).toBe(400);
    });
  });

  // ─── Not found ────────────────────────────────────────────────────────────

  describe('Not found', () => {
    it('GET /tasks/99999999 → 404', async () => {
      const res = await request(app.getHttpServer())
        .get('/tasks/99999999')
        .set(authHeader());

      expect(res.status).toBe(404);
    });

    it('PATCH /tasks/99999999 → 404', async () => {
      const res = await request(app.getHttpServer())
        .patch('/tasks/99999999')
        .set(authHeader())
        .send({ title: 'Ghost update' });

      expect(res.status).toBe(404);
    });

    it('DELETE /tasks/99999999 → 404', async () => {
      const res = await request(app.getHttpServer())
        .delete('/tasks/99999999')
        .set(authHeader());

      expect(res.status).toBe(404);
    });
  });
});
