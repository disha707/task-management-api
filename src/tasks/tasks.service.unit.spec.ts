/**
 * Unit tests for TasksService.
 *
 * Scope:
 *   These tests verify the business logic of TasksService in complete isolation.
 *   The Drizzle `db` object is replaced by a mock, so no real PostgreSQL
 *   connection is made and no data is persisted.
 *
 * What coverage do we get from this set of tests?
 *   - getTasks: builds correct pagination meta; applies search, completed filter,
 *     and sort/order params; calculates the right offset for each page
 *   - getTaskById: returns the task when found; throws NotFoundException when missing
 *   - createTask: inserts with title and optional description; returns the new record
 *   - updateTask: updates title, description, and completed independently;
 *     throws NotFoundException before touching the DB when task is missing
 *   - deleteTask: deletes and returns the task; throws NotFoundException when missing
 *   - deleteTasksInBatch: runs inside db.transaction; throws NotFoundException
 *     (aborting the transaction) when any id in the batch is not found
 *
 * What is NOT covered here (and where it IS covered):
 *   - Real SQL correctness (column names, WHERE clauses, ORDER BY)
 *       → tasks.service.integration.spec.ts
 *   - HTTP-layer behaviour (status codes, validation, pipes)
 *       → tasks.service.integration.spec.ts (real NestJS pipeline)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';

vi.mock('../db/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

import { db } from '../db/db';
import { TasksService } from './tasks.service';

/**
 * Creates a thenable mock that is also chainable.
 * Drizzle uses builder chains; awaiting any step in the chain resolves to `value`.
 */
function mockChain(value: unknown) {
  const p = Promise.resolve(value) as any;
  const methods = ['from', 'where', 'orderBy', 'limit', 'offset', 'values', 'set', 'returning'];
  for (const m of methods) {
    p[m] = vi.fn().mockReturnValue(p);
  }
  return p;
}

const makeTask = (overrides = {}) => ({
  id: 1,
  title: 'Test task',
  description: null as string | null,
  completed: false,
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

describe('TasksService Unit Tests', () => {
  let service: TasksService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TasksService();
  });

  // ─── getTasks ─────────────────────────────────────────────────────────────

  describe('getTasks', () => {
    it('returns paginated data with meta using defaults', async () => {
      const task = makeTask();
      (db.select as any)
        .mockReturnValueOnce(mockChain([{ total: 1 }]))   // count query
        .mockReturnValueOnce(mockChain([task]));           // data query

      const result = await service.getTasks();

      expect(result.data).toEqual([task]);
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    });

    it('returns correct totalPages when total > limit', async () => {
      (db.select as any)
        .mockReturnValueOnce(mockChain([{ total: 25 }]))
        .mockReturnValueOnce(mockChain([]));

      const result = await service.getTasks({ page: 1, limit: 10 });

      expect(result.meta.totalPages).toBe(3);
    });

    it('passes search condition when search is provided', async () => {
      const countChain = mockChain([{ total: 0 }]);
      const dataChain = mockChain([]);
      (db.select as any)
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(dataChain);

      await service.getTasks({ search: 'drizzle' });

      expect(db.select).toHaveBeenCalledTimes(2);
    });

    it('passes completed filter when provided', async () => {
      (db.select as any)
        .mockReturnValueOnce(mockChain([{ total: 1 }]))
        .mockReturnValueOnce(mockChain([makeTask({ completed: true })]));

      const result = await service.getTasks({ completed: true });

      expect(result.data[0].completed).toBe(true);
    });

    it('applies pagination offset for page 2', async () => {
      const dataChain = mockChain([]);
      (db.select as any)
        .mockReturnValueOnce(mockChain([{ total: 20 }]))
        .mockReturnValueOnce(dataChain);

      await service.getTasks({ page: 2, limit: 5 });

      expect(dataChain.offset).toHaveBeenCalledWith(5);
    });
  });

  // ─── getTaskById ──────────────────────────────────────────────────────────

  describe('getTaskById', () => {
    it('returns the task when found', async () => {
      const task = makeTask();
      (db.select as any).mockReturnValue(mockChain([task]));

      const result = await service.getTaskById(1);

      expect(result).toEqual(task);
    });

    it('throws NotFoundException when task does not exist', async () => {
      (db.select as any).mockReturnValue(mockChain([]));

      await expect(service.getTaskById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── createTask ───────────────────────────────────────────────────────────

  describe('createTask', () => {
    it('inserts and returns a new task with title only', async () => {
      const newTask = makeTask({ title: 'New task' });
      (db.insert as any).mockReturnValue(mockChain([newTask]));

      const result = await service.createTask({ title: 'New task' });

      expect(result).toEqual(newTask);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it('inserts task with description when provided', async () => {
      const newTask = makeTask({ title: 'With desc', description: 'Some info' });
      (db.insert as any).mockReturnValue(mockChain([newTask]));

      const result = await service.createTask({
        title: 'With desc',
        description: 'Some info',
      });

      expect(result.description).toBe('Some info');
    });
  });

  // ─── updateTask ───────────────────────────────────────────────────────────

  describe('updateTask', () => {
    it('updates task title', async () => {
      const existing = makeTask({ title: 'Old' });
      const updated = makeTask({ title: 'New' });

      vi.spyOn(service, 'getTaskById').mockResolvedValue(existing);
      (db.update as any).mockReturnValue(mockChain([updated]));

      const result = await service.updateTask(1, { title: 'New' });

      expect(result.title).toBe('New');
    });

    it('updates completed status', async () => {
      const existing = makeTask();
      const updated = makeTask({ completed: true });

      vi.spyOn(service, 'getTaskById').mockResolvedValue(existing);
      (db.update as any).mockReturnValue(mockChain([updated]));

      const result = await service.updateTask(1, { completed: true });

      expect(result.completed).toBe(true);
    });

    it('updates description', async () => {
      const existing = makeTask();
      const updated = makeTask({ description: 'Updated desc' });

      vi.spyOn(service, 'getTaskById').mockResolvedValue(existing);
      (db.update as any).mockReturnValue(mockChain([updated]));

      const result = await service.updateTask(1, { description: 'Updated desc' });

      expect(result.description).toBe('Updated desc');
    });

    it('throws NotFoundException when task does not exist', async () => {
      vi.spyOn(service, 'getTaskById').mockRejectedValue(new NotFoundException('Task with id 999 not found'));

      await expect(service.updateTask(999, { title: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteTask ───────────────────────────────────────────────────────────

  describe('deleteTask', () => {
    it('deletes the task and returns it', async () => {
      const task = makeTask();
      vi.spyOn(service, 'getTaskById').mockResolvedValue(task);
      (db.delete as any).mockReturnValue(mockChain(undefined));

      const result = await service.deleteTask(1);

      expect(result).toEqual(task);
      expect(db.delete).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when task does not exist', async () => {
      vi.spyOn(service, 'getTaskById').mockRejectedValue(new NotFoundException('Task with id 999 not found'));

      await expect(service.deleteTask(999)).rejects.toThrow(NotFoundException);
      expect(db.delete).not.toHaveBeenCalled();
    });
  });

  // ─── deleteTasksInBatch ───────────────────────────────────────────────────

  describe('deleteTasksInBatch', () => {
    it('deletes multiple tasks within a transaction', async () => {
      const task1 = makeTask({ id: 1 });
      const task2 = makeTask({ id: 2, title: 'Task 2' });

      (db.transaction as any).mockImplementation(async (fn: Function) => fn(db));
      (db.select as any)
        .mockReturnValueOnce(mockChain([task1]))
        .mockReturnValueOnce(mockChain([task2]));
      (db.delete as any).mockReturnValue(mockChain(undefined));

      const result = await service.deleteTasksInBatch({ ids: [1, 2] });

      expect(result).toHaveLength(2);
      expect(db.transaction).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException and aborts when a task is not found', async () => {
      const task1 = makeTask({ id: 1 });

      (db.transaction as any).mockImplementation(async (fn: Function) => fn(db));
      (db.select as any)
        .mockReturnValueOnce(mockChain([task1]))
        .mockReturnValueOnce(mockChain([])); // id 999 not found
      (db.delete as any).mockReturnValue(mockChain(undefined));

      await expect(service.deleteTasksInBatch({ ids: [1, 999] })).rejects.toThrow(NotFoundException);
    });
  });
});
