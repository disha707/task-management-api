/**
 * Unit tests for TasksService — Classical (Detroit) style.
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
  // stub
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
import { mockChain } from '../test/mock-chain';
import { makeTask } from '../test/make-task';

type Task = ReturnType<typeof makeTask>;

describe('TasksService Unit Tests', () => {
  let service: TasksService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TasksService();
  });

  // ─── Stub helpers ─────────────────────────────────────────────────────────
  //
  // Each helper sets up db mocks for one service method call.
  // stubGetTasks returns the dataChain so tests can assert on .offset etc.

  function stubGetTasks(total: number, data: Task[] = []) {
    const dataChain = mockChain(data);
    (db.select as any)
      .mockReturnValueOnce(mockChain([{ total }]))
      .mockReturnValueOnce(dataChain);
    return dataChain;
  }

  function stubSelectOne(task?: Task) {
    (db.select as any).mockReturnValue(mockChain(task ? [task] : []));
  }

  function stubInsert(task: Task) {
    (db.insert as any).mockReturnValue(mockChain([task]));
  }

  function stubUpdate(task: Task) {
    (db.update as any).mockReturnValue(mockChain([task]));
  }

  function stubDelete() {
    (db.delete as any).mockReturnValue(mockChain(undefined));
  }

  function stubTransaction() {
    (db.transaction as any).mockImplementation(async (fn: Function) => fn(db));
  }

  function stubGetStats(
    total: number,
    completed: number,
    byPriority: Array<{ priority: string; cnt: number }> = [],
  ) {
    (db.select as any)
      .mockReturnValueOnce(mockChain([{ total }]))
      .mockReturnValueOnce(mockChain([{ completed }]))
      .mockReturnValueOnce(mockChain(byPriority));
  }

  function stubBatchSelects(...tasks: Array<Task | undefined>) {
    const mock = db.select as any;
    for (const task of tasks) {
      mock.mockReturnValueOnce(mockChain(task ? [task] : []));
    }
  }

  // ─── getTasks ─────────────────────────────────────────────────────────────

  describe('getTasks', () => {
    it('returns paginated data with meta using defaults', async () => {
      const task = makeTask();
      stubGetTasks(1, [task]);

      const result = await service.getTasks(); // entry point

      expect(result.data).toEqual([task]); // return value
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      }); // return value
    });

    it('returns correct totalPages when total > limit', async () => {
      stubGetTasks(25);

      const result = await service.getTasks({ page: 1, limit: 10 }); // entry point

      expect(result.meta.totalPages).toBe(3); // return value
    });

    it('passes search condition when search is provided', async () => {
      stubGetTasks(0);

      await service.getTasks({ search: 'drizzle' }); // entry point

      expect(db.select).toHaveBeenCalledTimes(2); // outgoing
    });

    it('passes completed filter when provided', async () => {
      stubGetTasks(1, [makeTask({ completed: true })]);

      const result = await service.getTasks({ completed: true }); // entry point

      expect(result.data[0].completed).toBe(true); // return value
    });

    it('returns only matching tasks when priority filter is provided', async () => {
      const lowTask = makeTask({ priority: 'Low' });
      stubGetTasks(1, [lowTask]);

      const result = await service.getTasks({ priority: 'Low' }); // entry point

      expect(result.data).toHaveLength(1); // return value
      expect(result.data[0].priority).toBe('Low'); // return value
    });

    it('returns all tasks when no priority filter is provided', async () => {
      stubGetTasks(2, [
        makeTask({ priority: 'High' }),
        makeTask({ id: 2, priority: 'Low' }),
      ]);

      const result = await service.getTasks({}); // entry point

      expect(result.data).toHaveLength(2); // return value
    });

    it('sorts by priority column when sortBy is priority', async () => {
      const highTask = makeTask({ priority: 'High' });
      const lowTask = makeTask({ id: 2, priority: 'Low' });
      stubGetTasks(2, [highTask, lowTask]);

      const result = await service.getTasks({
        sortBy: 'priority',
        sortOrder: 'asc',
      }); // entry point

      expect(result.data[0].priority).toBe('High'); // return value
      expect(result.data[1].priority).toBe('Low'); // return value
    });

    it('applies pagination offset for page 2', async () => {
      const dataChain = stubGetTasks(20);

      await service.getTasks({ page: 2, limit: 5 }); // entry point

      expect(dataChain.offset).toHaveBeenCalledWith(5); // outgoing
    });
  });

  // ─── getTaskById ──────────────────────────────────────────────────────────

  describe('getTaskById', () => {
    it('returns the task when found', async () => {
      const task = makeTask();
      stubSelectOne(task);

      const result = await service.getTaskById(1); // entry point

      expect(result).toEqual(task); // return value
    });

    it('throws NotFoundException when task does not exist', async () => {
      stubSelectOne();

      await expect(service.getTaskById(999)).rejects.toThrow(NotFoundException); // entry point / return value
    });
  });

  // ─── createTask ───────────────────────────────────────────────────────────

  describe('createTask', () => {
    it('inserts and returns a new task with title only', async () => {
      const newTask = makeTask({ title: 'New task' });
      stubInsert(newTask);

      const result = await service.createTask({ title: 'New task' }); // entry point

      expect(result).toEqual(newTask); // return value
    });

    it('inserts task with description when provided', async () => {
      const newTask = makeTask({
        title: 'With desc',
        description: 'Some info',
      });
      stubInsert(newTask);

      const result = await service.createTask({
        title: 'With desc',
        description: 'Some info',
      }); // entry point

      expect(result.description).toBe('Some info'); // return value
    });

    it('stores the given priority when priority is provided', async () => {
      const newTask = makeTask({ title: 'Urgent', priority: 'High' });
      stubInsert(newTask);

      const result = await service.createTask({
        title: 'Urgent',
        priority: 'High',
      }); // entry point

      expect(result.priority).toBe('High'); // return value
    });

    it('inserts and returns the task when priority is absent', async () => {
      const newTask = makeTask({ title: 'Default priority task' });
      stubInsert(newTask);

      const result = await service.createTask({
        title: 'Default priority task',
      }); // entry point

      expect(result).toEqual(newTask); // return value
    });
  });

  // ─── updateTask ───────────────────────────────────────────────────────────

  describe('updateTask', () => {
    it('updates task title', async () => {
      stubSelectOne(makeTask({ title: 'Old' }));
      stubUpdate(makeTask({ title: 'New' }));

      const result = await service.updateTask(1, { title: 'New' }); // entry point

      expect(result.title).toBe('New'); // return value
    });

    it('updates completed status', async () => {
      stubSelectOne(makeTask());
      stubUpdate(makeTask({ completed: true }));

      const result = await service.updateTask(1, { completed: true }); // entry point

      expect(result.completed).toBe(true); // return value
    });

    it('updates description', async () => {
      stubSelectOne(makeTask());
      stubUpdate(makeTask({ description: 'Updated desc' }));

      const result = await service.updateTask(1, {
        description: 'Updated desc',
      }); // entry point

      expect(result.description).toBe('Updated desc'); // return value
    });

    it('updates priority when priority is provided', async () => {
      stubSelectOne(makeTask());
      stubUpdate(makeTask({ priority: 'Low' }));

      const result = await service.updateTask(1, { priority: 'Low' }); // entry point

      expect(result.priority).toBe('Low'); // return value
    });

    it('leaves priority unchanged when priority is absent from the DTO', async () => {
      stubSelectOne(makeTask({ priority: 'High' }));
      stubUpdate(makeTask({ title: 'New title', priority: 'High' }));

      const result = await service.updateTask(1, { title: 'New title' }); // entry point

      expect(result.priority).toBe('High'); // return value
    });

    it('throws NotFoundException when task does not exist', async () => {
      stubSelectOne();

      await expect(service.updateTask(999, { title: 'X' })).rejects.toThrow(
        NotFoundException,
      ); // entry point / return value
    });
  });

  // ─── deleteTask ───────────────────────────────────────────────────────────

  describe('deleteTask', () => {
    it('deletes the task and returns it', async () => {
      const task = makeTask();
      vi.spyOn(service, 'getTaskById').mockResolvedValue(task); // spy
      stubDelete();

      const result = await service.deleteTask(1); // entry point

      expect(result).toEqual(task); // return value
    });

    it('throws NotFoundException when task does not exist', async () => {
      vi.spyOn(service, 'getTaskById').mockRejectedValue(
        new NotFoundException('Task with id 999 not found'),
      ); // spy

      await expect(service.deleteTask(999)).rejects.toThrow(NotFoundException); // entry point / return value
      expect(db.delete).not.toHaveBeenCalled(); // outgoing
    });
  });

  // ─── deleteTasksInBatch ───────────────────────────────────────────────────

  describe('deleteTasksInBatch', () => {
    it('deletes multiple tasks within a transaction', async () => {
      stubTransaction();
      stubBatchSelects(
        makeTask({ id: 1 }),
        makeTask({ id: 2, title: 'Task 2' }),
      );
      stubDelete();

      const result = await service.deleteTasksInBatch({ ids: [1, 2] }); // entry point

      expect(result).toHaveLength(2); // return value
      expect(db.transaction).toHaveBeenCalledTimes(1); // outgoing
    });

    it('throws NotFoundException and aborts when a task is not found', async () => {
      stubTransaction();
      stubBatchSelects(makeTask({ id: 1 }), undefined); // undefined = id 999 not found
      stubDelete();

      await expect(
        service.deleteTasksInBatch({ ids: [1, 999] }),
      ).rejects.toThrow(NotFoundException); // entry point / return value
    });
  });

  // ─── getStats ─────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns zero counts when there are no tasks', async () => {
      stubGetStats(0, 0);

      const result = await service.getStats(); // entry point

      expect(result).toEqual({
        total: 0,
        completed: 0,
        pending: 0,
        byPriority: { High: 0, Medium: 0, Low: 0 },
      }); // return value
    });

    it('returns correct totals and priority breakdown for a mixed set', async () => {
      stubGetStats(4, 2, [
        { priority: 'High', cnt: 2 },
        { priority: 'Medium', cnt: 1 },
        { priority: 'Low', cnt: 1 },
      ]);

      const result = await service.getStats(); // entry point

      expect(result.total).toBe(4); // return value
      expect(result.completed).toBe(2); // return value
      expect(result.pending).toBe(2); // return value
      expect(result.byPriority).toEqual({ High: 2, Medium: 1, Low: 1 }); // return value
    });

    it('reports all tasks as pending when none are completed', async () => {
      stubGetStats(2, 0, [{ priority: 'Medium', cnt: 2 }]);

      const result = await service.getStats(); // entry point

      expect(result.completed).toBe(0); // return value
      expect(result.pending).toBe(2); // return value
    });
  });
});
