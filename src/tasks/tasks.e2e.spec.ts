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

import type { Server } from 'http';

import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';

import { AppModule } from '../app.module';
import { db } from '../db/db';
import { tasks } from '../db/schema';

interface TaskResponse {
  id: number;
  title: string;
  completed: boolean;
  priority: string;
}

interface PaginatedTasksResponse {
  data: TaskResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface StatsResponse {
  total: number;
  completed: number;
  pending: number;
  byPriority: { High: number; Medium: number; Low: number };
}

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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    const res = await request(getServer())
      .post('/auth/register')
      .send({ email: TEST_USER_EMAIL, password: 'securepass' });

    accessToken = (res.body as { access_token: string }).access_token;
  });

  afterAll(async () => {
    if (createdTaskIds.length) {
      await db.delete(tasks).where(inArray(tasks.id, [...createdTaskIds]));
    }
    await app.close();
  });

  function getServer(): Server {
    return app.getHttpServer() as Server;
  }

  function authHeader() {
    return { Authorization: `Bearer ${accessToken}` };
  }

  // ─── GET /tasks/stats ────────────────────────────────────────────────────

  describe('GET /tasks/stats', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(getServer()).get('/tasks/stats');
      expect(res.status).toBe(401);
    });

    it('returns stats shape with correct keys', async () => {
      const res = await request(getServer())
        .get('/tasks/stats')
        .set(authHeader());

      const body = res.body as StatsResponse;
      expect(res.status).toBe(200);
      expect(typeof body.total).toBe('number');
      expect(typeof body.completed).toBe('number');
      expect(typeof body.pending).toBe('number');
      expect(body.byPriority).toMatchObject({
        High: expect.any(Number) as number,
        Medium: expect.any(Number) as number,
        Low: expect.any(Number) as number,
      });
      expect(body.total).toBe(body.completed + body.pending);
    });
  });

  // ─── DELETE /tasks/bulk ───────────────────────────────────────────────────

  describe('DELETE /tasks/bulk', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(getServer())
        .delete('/tasks/bulk')
        .send({ ids: [1] });
      expect(res.status).toBe(401);
    });

    it('deletes multiple tasks and returns them → 200', async () => {
      const t1 = await request(getServer())
        .post('/tasks')
        .set(authHeader())
        .send({ title: 'Bulk delete task 1' });
      const t2 = await request(getServer())
        .post('/tasks')
        .set(authHeader())
        .send({ title: 'Bulk delete task 2' });

      const t1Body = t1.body as TaskResponse;
      const t2Body = t2.body as TaskResponse;

      const res = await request(getServer())
        .delete('/tasks/bulk')
        .set(authHeader())
        .send({ ids: [t1Body.id, t2Body.id] });

      const deleted = res.body as TaskResponse[];
      expect(res.status).toBe(200);
      expect(deleted).toHaveLength(2);
      expect(deleted.map((t) => t.id).sort()).toEqual(
        [t1Body.id, t2Body.id].sort(),
      );
    });

    it('returns 404 when one id in the batch does not exist', async () => {
      const t = await request(getServer())
        .post('/tasks')
        .set(authHeader())
        .send({ title: 'Batch partial task' });
      createdTaskIds.push((t.body as TaskResponse).id);

      const res = await request(getServer())
        .delete('/tasks/bulk')
        .set(authHeader())
        .send({ ids: [(t.body as TaskResponse).id, 99999999] });

      expect(res.status).toBe(404);
    });

    it('returns 400 when ids array is empty', async () => {
      const res = await request(getServer())
        .delete('/tasks/bulk')
        .set(authHeader())
        .send({ ids: [] });
      expect(res.status).toBe(400);
    });
  });

  // ─── Unauthenticated — guard blocks all task routes ───────────────────────

  describe('JWT guard: requests without Authorization header', () => {
    it('GET /tasks → 401', async () => {
      const res = await request(getServer()).get('/tasks');
      expect(res.status).toBe(401);
    });

    it('POST /tasks → 401', async () => {
      const res = await request(getServer())
        .post('/tasks')
        .send({ title: 'Unauthenticated task' });
      expect(res.status).toBe(401);
    });

    it('GET /tasks/1 → 401', async () => {
      const res = await request(getServer()).get('/tasks/1');
      expect(res.status).toBe(401);
    });

    it('PATCH /tasks/1 → 401', async () => {
      const res = await request(getServer())
        .patch('/tasks/1')
        .send({ completed: true });
      expect(res.status).toBe(401);
    });

    it('DELETE /tasks/1 → 401', async () => {
      const res = await request(getServer()).delete('/tasks/1');
      expect(res.status).toBe(401);
    });
  });

  // ─── Authenticated — CRUD happy path ─────────────────────────────────────

  describe('Authenticated CRUD', () => {
    let createdTaskId: number;

    it('POST /tasks with valid body → 201 with task shape', async () => {
      const res = await request(getServer())
        .post('/tasks')
        .set(authHeader())
        .send({ title: 'E2E task' });

      const body = res.body as TaskResponse;
      expect(res.status).toBe(201);
      expect(body).toMatchObject({
        title: 'E2E task',
        completed: false,
        priority: 'Medium',
      });
      expect(typeof body.id).toBe('number');

      createdTaskId = body.id;
      createdTaskIds.push(createdTaskId);
    });

    it('GET /tasks → 200 with data array and meta object', async () => {
      const res = await request(getServer()).get('/tasks').set(authHeader());

      const body = res.body as PaginatedTasksResponse;
      expect(res.status).toBe(200);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta).toMatchObject({
        page: expect.any(Number) as number,
        limit: expect.any(Number) as number,
        total: expect.any(Number) as number,
        totalPages: expect.any(Number) as number,
      });
    });

    it('GET /tasks/:id → 200 returns the task', async () => {
      const res = await request(getServer())
        .get(`/tasks/${createdTaskId}`)
        .set(authHeader());

      const body = res.body as TaskResponse;
      expect(res.status).toBe(200);
      expect(body.id).toBe(createdTaskId);
      expect(body.title).toBe('E2E task');
    });

    it('PATCH /tasks/:id with { completed: true } → 200 with completed = true', async () => {
      const res = await request(getServer())
        .patch(`/tasks/${createdTaskId}`)
        .set(authHeader())
        .send({ completed: true });

      expect(res.status).toBe(200);
      expect((res.body as TaskResponse).completed).toBe(true);
    });

    it('PATCH /tasks/:id with { priority: "High" } → 200 with priority = High', async () => {
      const res = await request(getServer())
        .patch(`/tasks/${createdTaskId}`)
        .set(authHeader())
        .send({ priority: 'High' });

      expect(res.status).toBe(200);
      expect((res.body as TaskResponse).priority).toBe('High');
    });

    it('DELETE /tasks/:id → 200 returns the deleted task', async () => {
      const taskToDelete = await request(getServer())
        .post('/tasks')
        .set(authHeader())
        .send({ title: 'Task to delete' });

      const taskId = (taskToDelete.body as TaskResponse).id;

      const res = await request(getServer())
        .delete(`/tasks/${taskId}`)
        .set(authHeader());

      expect(res.status).toBe(200);
      expect((res.body as TaskResponse).id).toBe(taskId);
    });
  });

  // ─── Validation — ValidationPipe enforces DTO constraints ─────────────────

  describe('Validation', () => {
    it('POST /tasks with empty body → 400', async () => {
      const res = await request(getServer())
        .post('/tasks')
        .set(authHeader())
        .send({});

      expect(res.status).toBe(400);
    });

    it('POST /tasks with title too short → 400', async () => {
      const res = await request(getServer())
        .post('/tasks')
        .set(authHeader())
        .send({ title: 'ab' });

      expect(res.status).toBe(400);
    });

    it('PATCH /tasks/:id with invalid priority → 400', async () => {
      const created = await request(getServer())
        .post('/tasks')
        .set(authHeader())
        .send({ title: 'Priority validation task' });

      createdTaskIds.push((created.body as TaskResponse).id);

      const res = await request(getServer())
        .patch(`/tasks/${(created.body as TaskResponse).id}`)
        .set(authHeader())
        .send({ priority: 'Critical' });

      expect(res.status).toBe(400);
    });

    it('GET /tasks?sortBy=invalid → 400', async () => {
      const res = await request(getServer())
        .get('/tasks?sortBy=invalid')
        .set(authHeader());

      expect(res.status).toBe(400);
    });
  });

  // ─── Not found ────────────────────────────────────────────────────────────

  describe('Not found', () => {
    it('GET /tasks/99999999 → 404', async () => {
      const res = await request(getServer())
        .get('/tasks/99999999')
        .set(authHeader());

      expect(res.status).toBe(404);
    });

    it('PATCH /tasks/99999999 → 404', async () => {
      const res = await request(getServer())
        .patch('/tasks/99999999')
        .set(authHeader())
        .send({ title: 'Ghost update' });

      expect(res.status).toBe(404);
    });

    it('DELETE /tasks/99999999 → 404', async () => {
      const res = await request(getServer())
        .delete('/tasks/99999999')
        .set(authHeader());

      expect(res.status).toBe(404);
    });
  });
});
