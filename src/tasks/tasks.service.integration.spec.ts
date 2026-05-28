/**
 * Integration tests for TasksService + PostgreSQL.
 *
 * Scope:
 *   These tests exercise TasksService against a real PostgreSQL database using
 *   the actual Drizzle queries.  A NestJS TestingModule is used to resolve the
 *   service through the DI container, but no HTTP server is started.
 *   Each test creates its own data and cleans it up in afterEach so tests are
 *   fully independent and can run in any order.
 *
 * What coverage do we get from this set of tests?
 *   - getTasks: pagination meta is correct; page/limit slicing works; search
 *     filters by title (ILIKE); completed filter returns only matching rows;
 *     sortBy=title with asc/desc produces correctly ordered results
 *   - getTaskById: retrieves an existing record; throws NotFoundException for
 *     an unknown id
 *   - createTask: persists title-only and title+description records; the new
 *     record can immediately be retrieved by id
 *   - updateTask: title, completed, and description are each independently
 *     updatable; partial updates leave untouched fields unchanged; throws
 *     NotFoundException for an unknown id
 *   - deleteTask: removes the record from the database and returns its data;
 *     throws NotFoundException for an unknown id
 *   - deleteTasksInBatch: deletes multiple records atomically; if any id is
 *     missing the transaction rolls back and all records survive
 *
 * What is NOT covered here (and where it IS covered):
 *   - Controller argument forwarding and return value pass-through
 *       → tasks.controller.unit.spec.ts
 *   - HTTP-layer behaviour (status codes, ParseIntPipe, ValidationPipe)
 *       — outside scope for this exercise; would require a running HTTP server
 *
 * Requires:
 *   DATABASE_URL set in .env pointing to a running PostgreSQL instance.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';

import { db } from '../db/db';
import { tasks } from '../db/schema';
import { TasksService } from './tasks.service';

describe('TasksService Integration Tests', () => {
  let service: TasksService;
  const createdIds: number[] = [];

  async function createTask(title: string, extra: Record<string, unknown> = {}) {
    const [task] = await db
      .insert(tasks)
      .values({ title, ...extra })
      .returning();
    createdIds.push(task.id);
    return task;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TasksService],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  afterEach(async () => {
    if (createdIds.length) {
      await db.delete(tasks).where(inArray(tasks.id, [...createdIds]));
      createdIds.length = 0;
    }
  });

  // ─── getTasks ─────────────────────────────────────────────────────────────

  describe('getTasks', () => {
    it('returns an array with pagination meta', async () => {
      const result = await service.getTasks();

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.meta).toMatchObject({
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it('paginates: limit restricts number of items returned', async () => {
      await createTask('Paginate task A');
      await createTask('Paginate task B');
      await createTask('Paginate task C');

      const result = await service.getTasks({ page: 1, limit: 2 });

      expect(result.data.length).toBeLessThanOrEqual(2);
      expect(result.meta.limit).toBe(2);
    });

    it('paginates: page 2 returns different items than page 1', async () => {
      for (let i = 1; i <= 4; i++) await createTask(`Paged task ${i}`);

      const page1 = await service.getTasks({ page: 1, limit: 2 });
      const page2 = await service.getTasks({ page: 2, limit: 2 });

      const ids1 = page1.data.map((t) => t.id);
      const ids2 = page2.data.map((t) => t.id);
      expect(ids1.some((id) => ids2.includes(id))).toBe(false);
    });

    it('filters by search term in title', async () => {
      await createTask('Unique drizzle search title');
      await createTask('Irrelevant task zxqw');

      const result = await service.getTasks({ search: 'drizzle search' });

      expect(result.data.some((t) => t.title.includes('drizzle search'))).toBe(true);
    });

    it('filters by completed status', async () => {
      await createTask('Incomplete task');
      await createTask('Completed task', { completed: true });

      const result = await service.getTasks({ completed: true, limit: 100 });

      expect(result.data.every((t) => t.completed === true)).toBe(true);
    });

    it('sorts by title ascending', async () => {
      await createTask('Zebra task');
      await createTask('Alpha task');

      const result = await service.getTasks({ sortBy: 'title', sortOrder: 'asc', limit: 100 });

      const titles = result.data.map((t) => t.title);
      const sorted = [...titles].sort((a, b) => a.localeCompare(b));
      expect(titles).toEqual(sorted);
    });

    it('sorts by title descending', async () => {
      await createTask('Aardvark task');
      await createTask('Zeppelin task');

      const result = await service.getTasks({ sortBy: 'title', sortOrder: 'desc', limit: 100 });

      const titles = result.data.map((t) => t.title);
      const sorted = [...titles].sort((a, b) => b.localeCompare(a));
      expect(titles).toEqual(sorted);
    });
  });

  // ─── getTaskById ──────────────────────────────────────────────────────────

  describe('getTaskById', () => {
    it('returns the task when it exists', async () => {
      const created = await createTask('Find me');

      const found = await service.getTaskById(created.id);

      expect(found).toEqual(created);
    });

    it('throws NotFoundException for a non-existent id', async () => {
      await expect(service.getTaskById(999999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── createTask ───────────────────────────────────────────────────────────

  describe('createTask', () => {
    it('creates a task with title only', async () => {
      const task = await service.createTask({ title: 'Only title' });
      createdIds.push(task.id);

      expect(task.title).toBe('Only title');
      expect(task.completed).toBe(false);
      expect(task.description).toBeNull();
    });

    it('creates a task with title and description', async () => {
      const task = await service.createTask({
        title: 'With description',
        description: 'A helpful description',
      });
      createdIds.push(task.id);

      expect(task.title).toBe('With description');
      expect(task.description).toBe('A helpful description');
    });

    it('persists the task so it can be retrieved', async () => {
      const task = await service.createTask({ title: 'Persistent task' });
      createdIds.push(task.id);

      const fetched = await service.getTaskById(task.id);
      expect(fetched.id).toBe(task.id);
    });
  });

  // ─── updateTask ───────────────────────────────────────────────────────────

  describe('updateTask', () => {
    it('updates the title', async () => {
      const task = await createTask('Old title');

      const updated = await service.updateTask(task.id, { title: 'New title' });

      expect(updated.title).toBe('New title');
    });

    it('marks a task as completed', async () => {
      const task = await createTask('Incomplete');

      const updated = await service.updateTask(task.id, { completed: true });

      expect(updated.completed).toBe(true);
    });

    it('updates description', async () => {
      const task = await createTask('Has no desc');

      const updated = await service.updateTask(task.id, {
        description: 'Now it has one',
      });

      expect(updated.description).toBe('Now it has one');
    });

    it('partial update: only changes provided fields', async () => {
      const task = await createTask('Keep me', { completed: true } as any);

      const updated = await service.updateTask(task.id, { title: 'Changed title' });

      expect(updated.title).toBe('Changed title');
      expect(updated.completed).toBe(true);
    });

    it('throws NotFoundException for a non-existent task', async () => {
      await expect(
        service.updateTask(999999, { title: 'Ghost' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteTask ───────────────────────────────────────────────────────────

  describe('deleteTask', () => {
    it('deletes the task and returns its data', async () => {
      const task = await createTask('Delete me');
      createdIds.splice(createdIds.indexOf(task.id), 1); // will be deleted by service

      const deleted = await service.deleteTask(task.id);

      expect(deleted.id).toBe(task.id);
      await expect(service.getTaskById(task.id)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when task does not exist', async () => {
      await expect(service.deleteTask(999999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteTasksInBatch ───────────────────────────────────────────────────

  describe('deleteTasksInBatch', () => {
    it('deletes multiple tasks atomically and returns them', async () => {
      const t1 = await createTask('Batch delete 1');
      const t2 = await createTask('Batch delete 2');
      createdIds.splice(createdIds.indexOf(t1.id), 1);
      createdIds.splice(createdIds.indexOf(t2.id), 1);

      const deleted = await service.deleteTasksInBatch({ ids: [t1.id, t2.id] });

      expect(deleted).toHaveLength(2);
      await expect(service.getTaskById(t1.id)).rejects.toThrow(NotFoundException);
      await expect(service.getTaskById(t2.id)).rejects.toThrow(NotFoundException);
    });

    it('throws and rolls back when any id is not found', async () => {
      const t1 = await createTask('Should survive rollback');

      await expect(
        service.deleteTasksInBatch({ ids: [t1.id, 999999] }),
      ).rejects.toThrow(NotFoundException);

      // t1 should still exist because transaction rolled back
      const stillExists = await service.getTaskById(t1.id);
      expect(stillExists.id).toBe(t1.id);
    });
  });
});
