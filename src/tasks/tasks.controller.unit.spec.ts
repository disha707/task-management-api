/**
 * Unit tests for TasksController — Classical (Detroit) style.
 *
 * Scope:
 *   These tests exercise TasksController with the real TasksService wired in.
 *   Only the database (the true external boundary) is replaced by a mock.
 *   No HTTP server is started and no NestJS request pipeline runs
 *   (no ValidationPipe, no ParseIntPipe).
 *
 *   Classical approach: we mock the external boundary (db), use real
 *   collaborators (TasksService), and assert on *outcomes* — what the
 *   controller returns — not on which internal methods were called.
 *
 * What coverage do we get from this set of tests?
 *   - getTasks: returns paginated data and meta from the real service
 *   - getTaskById: returns the correct task; propagates NotFoundException
 *   - createTask: returns the newly created task record
 *   - updateTask: returns the updated task; propagates NotFoundException
 *   - deleteTask: returns the deleted task; propagates NotFoundException
 *   - deleteTasksInBatch: returns deleted tasks array; propagates
 *     NotFoundException when any id is missing
 *
 * What is NOT covered here (and where it IS covered):
 *   - Real SQL correctness and DB-level behaviour
 *       → tasks.service.integration.spec.ts
 *   - HTTP status codes, request parsing, and validation pipes
 *       → would require a running HTTP server
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

function mockChain(value: unknown) {
  const p = Promise.resolve(value) as any;
  const methods = ['from', 'where', 'orderBy', 'limit', 'offset', 'values', 'set', 'returning'];
  for (const m of methods) p[m] = vi.fn().mockReturnValue(p);
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

describe('TasksController Unit Tests (Classical)', () => {
  let controller: TasksController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [TasksService],
    }).compile();

    controller = module.get<TasksController>(TasksController);
  });

  // ─── getTasks ─────────────────────────────────────────────────────────────

  describe('getTasks', () => {
    it('returns paginated data with meta', async () => {
      const task = makeTask();
      (db.select as any)
        .mockReturnValueOnce(mockChain([{ total: 1 }]))
        .mockReturnValueOnce(mockChain([task]));

      const result = await controller.getTasks({ page: 1, limit: 10 });

      expect(result.data).toEqual([task]);
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    });
  });

  // ─── getTaskById ──────────────────────────────────────────────────────────

  describe('getTaskById', () => {
    it('returns the task when found', async () => {
      const task = makeTask({ id: 42 });
      (db.select as any).mockReturnValue(mockChain([task]));

      const result = await controller.getTaskById(42);

      expect(result).toEqual(task);
    });

    it('propagates NotFoundException for an unknown id', async () => {
      (db.select as any).mockReturnValue(mockChain([]));

      await expect(controller.getTaskById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── createTask ───────────────────────────────────────────────────────────

  describe('createTask', () => {
    it('returns the newly created task', async () => {
      const created = makeTask({ title: 'New task', description: 'Some info' });
      (db.insert as any).mockReturnValue(mockChain([created]));

      const result = await controller.createTask({ title: 'New task', description: 'Some info' });

      expect(result).toEqual(created);
    });
  });

  // ─── updateTask ───────────────────────────────────────────────────────────

  describe('updateTask', () => {
    it('returns the updated task', async () => {
      const existing = makeTask();
      const updated = makeTask({ title: 'New title' });
      (db.select as any).mockReturnValue(mockChain([existing]));
      (db.update as any).mockReturnValue(mockChain([updated]));

      const result = await controller.updateTask(1, { title: 'New title' });

      expect(result.title).toBe('New title');
    });

    it('propagates NotFoundException when task does not exist', async () => {
      (db.select as any).mockReturnValue(mockChain([]));

      await expect(controller.updateTask(999, { title: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteTask ───────────────────────────────────────────────────────────

  describe('deleteTask', () => {
    it('returns the deleted task', async () => {
      const task = makeTask({ id: 3 });
      (db.select as any).mockReturnValue(mockChain([task]));
      (db.delete as any).mockReturnValue(mockChain(undefined));

      const result = await controller.deleteTask(3);

      expect(result).toEqual(task);
    });

    it('propagates NotFoundException when task does not exist', async () => {
      (db.select as any).mockReturnValue(mockChain([]));

      await expect(controller.deleteTask(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteTasksInBatch ───────────────────────────────────────────────────

  describe('deleteTasksInBatch', () => {
    it('returns all deleted tasks', async () => {
      const task1 = makeTask({ id: 1 });
      const task2 = makeTask({ id: 2, title: 'Task 2' });
      (db.transaction as any).mockImplementation(async (fn: Function) => fn(db));
      (db.select as any)
        .mockReturnValueOnce(mockChain([task1]))
        .mockReturnValueOnce(mockChain([task2]));
      (db.delete as any).mockReturnValue(mockChain(undefined));

      const result = await controller.deleteTasksInBatch({ ids: [1, 2] });

      expect(result).toHaveLength(2);
    });

    it('propagates NotFoundException when any id is not found', async () => {
      (db.transaction as any).mockImplementation(async (fn: Function) => fn(db));
      (db.select as any)
        .mockReturnValueOnce(mockChain([makeTask()]))
        .mockReturnValueOnce(mockChain([]));
      (db.delete as any).mockReturnValue(mockChain(undefined));

      await expect(controller.deleteTasksInBatch({ ids: [1, 999] })).rejects.toThrow(NotFoundException);
    });
  });
});
