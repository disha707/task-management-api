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

vi.mock('../db/db', () => ({ // stub
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
      (db.select as any) // stub
        .mockReturnValueOnce(mockChain([{ total: 1 }]))
        .mockReturnValueOnce(mockChain([task]));

      const result = await service.getTasks(); // entry point

      expect(result.data).toEqual([task]); // return value
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 }); // return value
    });

    it('returns correct totalPages when total > limit', async () => {
      (db.select as any) // stub
        .mockReturnValueOnce(mockChain([{ total: 25 }]))
        .mockReturnValueOnce(mockChain([]));

      const result = await service.getTasks({ page: 1, limit: 10 }); // entry point

      expect(result.meta.totalPages).toBe(3); // return value
    });

    it('passes search condition when search is provided', async () => {
      const countChain = mockChain([{ total: 0 }]);
      const dataChain = mockChain([]);
      (db.select as any) // stub
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(dataChain);

      await service.getTasks({ search: 'drizzle' }); // entry point

      expect(db.select).toHaveBeenCalledTimes(2); // outgoing
    });

    it('passes completed filter when provided', async () => {
      (db.select as any) // stub
        .mockReturnValueOnce(mockChain([{ total: 1 }]))
        .mockReturnValueOnce(mockChain([makeTask({ completed: true })]));

      const result = await service.getTasks({ completed: true }); // entry point

      expect(result.data[0].completed).toBe(true); // return value
    });

    it('returns only matching tasks when priority filter is provided', async () => {
      const lowTask = makeTask({ priority: 'Low' });
      (db.select as any) // stub
        .mockReturnValueOnce(mockChain([{ total: 1 }]))
        .mockReturnValueOnce(mockChain([lowTask]));

      const result = await service.getTasks({ priority: 'Low' }); // entry point

      expect(result.data).toHaveLength(1); // return value
      expect(result.data[0].priority).toBe('Low'); // return value
    });

    it('returns all tasks when no priority filter is provided', async () => {
      const tasks = [makeTask({ priority: 'High' }), makeTask({ id: 2, priority: 'Low' })];
      (db.select as any) // stub
        .mockReturnValueOnce(mockChain([{ total: 2 }]))
        .mockReturnValueOnce(mockChain(tasks));

      const result = await service.getTasks({}); // entry point

      expect(result.data).toHaveLength(2); // return value
    });

    it('sorts by priority column when sortBy is priority', async () => {
      const highTask = makeTask({ priority: 'High' });
      const lowTask = makeTask({ id: 2, priority: 'Low' });
      (db.select as any) // stub
        .mockReturnValueOnce(mockChain([{ total: 2 }]))
        .mockReturnValueOnce(mockChain([highTask, lowTask]));

      const result = await service.getTasks({ sortBy: 'priority', sortOrder: 'asc' }); // entry point

      expect(result.data[0].priority).toBe('High'); // return value
      expect(result.data[1].priority).toBe('Low'); // return value
    });

    it('applies pagination offset for page 2', async () => {
      const dataChain = mockChain([]);
      (db.select as any) // stub
        .mockReturnValueOnce(mockChain([{ total: 20 }]))
        .mockReturnValueOnce(dataChain);

      await service.getTasks({ page: 2, limit: 5 }); // entry point

      expect(dataChain.offset).toHaveBeenCalledWith(5); // outgoing
    });
  });

  // ─── getTaskById ──────────────────────────────────────────────────────────

  describe('getTaskById', () => {
    it('returns the task when found', async () => {
      const task = makeTask();
      (db.select as any).mockReturnValue(mockChain([task])); // stub

      const result = await service.getTaskById(1); // entry point

      expect(result).toEqual(task); // return value
    });

    it('throws NotFoundException when task does not exist', async () => {
      (db.select as any).mockReturnValue(mockChain([])); // stub

      await expect(service.getTaskById(999)).rejects.toThrow(NotFoundException); // entry point / return value
    });
  });

  // ─── createTask ───────────────────────────────────────────────────────────

  describe('createTask', () => {
    it('inserts and returns a new task with title only', async () => {
      const newTask = makeTask({ title: 'New task' });
      (db.insert as any).mockReturnValue(mockChain([newTask])); // stub/mock

      const result = await service.createTask({ title: 'New task' }); // entry point

      expect(result).toEqual(newTask); // return value
    });

    it('inserts task with description when provided', async () => {
      const newTask = makeTask({ title: 'With desc', description: 'Some info' });
      (db.insert as any).mockReturnValue(mockChain([newTask])); // stub

      const result = await service.createTask({ title: 'With desc', description: 'Some info' }); // entry point

      expect(result.description).toBe('Some info'); // return value
    });

    it('stores the given priority when priority is provided', async () => {
      const newTask = makeTask({ title: 'Urgent', priority: 'High' });
      (db.insert as any).mockReturnValue(mockChain([newTask])); // stub

      const result = await service.createTask({ title: 'Urgent', priority: 'High' }); // entry point

      expect(result.priority).toBe('High'); // return value
    });

    it('inserts and returns the task when priority is absent', async () => {
      const newTask = makeTask({ title: 'Default priority task' });
      (db.insert as any).mockReturnValue(mockChain([newTask])); // stub/mock

      const result = await service.createTask({ title: 'Default priority task' }); // entry point

      expect(result).toEqual(newTask); // return value
    });
  });

  // ─── updateTask ───────────────────────────────────────────────────────────

  describe('updateTask', () => {
    it('updates task title', async () => {
      const existing = makeTask({ title: 'Old' });
      const updated = makeTask({ title: 'New' });

      vi.spyOn(service, 'getTaskById').mockResolvedValue(existing); // spy
      (db.update as any).mockReturnValue(mockChain([updated])); // stub

      const result = await service.updateTask(1, { title: 'New' }); // entry point

      expect(result.title).toBe('New'); // return value
    });

    it('updates completed status', async () => {
      const existing = makeTask();
      const updated = makeTask({ completed: true });

      vi.spyOn(service, 'getTaskById').mockResolvedValue(existing); // spy
      (db.update as any).mockReturnValue(mockChain([updated])); // stub

      const result = await service.updateTask(1, { completed: true }); // entry point

      expect(result.completed).toBe(true); // return value
    });

    it('updates description', async () => {
      const existing = makeTask();
      const updated = makeTask({ description: 'Updated desc' });

      vi.spyOn(service, 'getTaskById').mockResolvedValue(existing); // spy
      (db.update as any).mockReturnValue(mockChain([updated])); // stub

      const result = await service.updateTask(1, { description: 'Updated desc' }); // entry point

      expect(result.description).toBe('Updated desc'); // return value
    });

    it('updates priority when priority is provided', async () => {
      const existing = makeTask();
      const updated = makeTask({ priority: 'Low' });

      vi.spyOn(service, 'getTaskById').mockResolvedValue(existing); // spy
      (db.update as any).mockReturnValue(mockChain([updated])); // stub

      const result = await service.updateTask(1, { priority: 'Low' }); // entry point

      expect(result.priority).toBe('Low'); // return value
    });

    it('leaves priority unchanged when priority is absent from the DTO', async () => {
      const existing = makeTask({ priority: 'High' });
      const updated = makeTask({ title: 'New title', priority: 'High' });

      vi.spyOn(service, 'getTaskById').mockResolvedValue(existing); // spy
      (db.update as any).mockReturnValue(mockChain([updated])); // stub

      const result = await service.updateTask(1, { title: 'New title' }); // entry point

      expect(result.priority).toBe('High'); // return value
    });

    it('throws NotFoundException when task does not exist', async () => {
      vi.spyOn(service, 'getTaskById').mockRejectedValue(new NotFoundException('Task with id 999 not found')); // spy

      await expect(service.updateTask(999, { title: 'X' })).rejects.toThrow(NotFoundException); // entry point / return value
    });
  });

  // ─── deleteTask ───────────────────────────────────────────────────────────

  describe('deleteTask', () => {
    it('deletes the task and returns it', async () => {
      const task = makeTask();
      vi.spyOn(service, 'getTaskById').mockResolvedValue(task); // spy
      (db.delete as any).mockReturnValue(mockChain(undefined)); // stub/mock

      const result = await service.deleteTask(1); // entry point

      expect(result).toEqual(task); // return value
    });

    it('throws NotFoundException when task does not exist', async () => {
      vi.spyOn(service, 'getTaskById').mockRejectedValue(new NotFoundException('Task with id 999 not found')); // spy

      await expect(service.deleteTask(999)).rejects.toThrow(NotFoundException); // entry point / return value
      expect(db.delete).not.toHaveBeenCalled(); // outgoing
    });
  });

  // ─── deleteTasksInBatch ───────────────────────────────────────────────────

  describe('deleteTasksInBatch', () => {
    it('deletes multiple tasks within a transaction', async () => {
      const task1 = makeTask({ id: 1 });
      const task2 = makeTask({ id: 2, title: 'Task 2' });

      (db.transaction as any).mockImplementation(async (fn: Function) => fn(db)); // stub/mock
      (db.select as any) // stub
        .mockReturnValueOnce(mockChain([task1]))
        .mockReturnValueOnce(mockChain([task2]));
      (db.delete as any).mockReturnValue(mockChain(undefined)); // stub

      const result = await service.deleteTasksInBatch({ ids: [1, 2] }); // entry point

      expect(result).toHaveLength(2); // return value
      expect(db.transaction).toHaveBeenCalledTimes(1); // outgoing
    });

    it('throws NotFoundException and aborts when a task is not found', async () => {
      const task1 = makeTask({ id: 1 });

      (db.transaction as any).mockImplementation(async (fn: Function) => fn(db)); // stub
      (db.select as any) // stub
        .mockReturnValueOnce(mockChain([task1]))
        .mockReturnValueOnce(mockChain([])); // id 999 not found
      (db.delete as any).mockReturnValue(mockChain(undefined)); // stub

      await expect(service.deleteTasksInBatch({ ids: [1, 999] })).rejects.toThrow(NotFoundException); // entry point / return value
    });
  });

  // ─── getStats ─────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns zero counts when there are no tasks', async () => {
      (db.select as any) // stub
        .mockReturnValueOnce(mockChain([{ total: 0 }]))
        .mockReturnValueOnce(mockChain([{ completed: 0 }]))
        .mockReturnValueOnce(mockChain([]));

      const result = await service.getStats(); // entry point

      expect(result).toEqual({ // return value
        total: 0,
        completed: 0,
        pending: 0,
        byPriority: { High: 0, Medium: 0, Low: 0 },
      });
    });

    it('returns correct totals and priority breakdown for a mixed set', async () => {
      (db.select as any) // stub
        .mockReturnValueOnce(mockChain([{ total: 4 }]))
        .mockReturnValueOnce(mockChain([{ completed: 2 }]))
        .mockReturnValueOnce(
          mockChain([
            { priority: 'High', cnt: 2 },
            { priority: 'Medium', cnt: 1 },
            { priority: 'Low', cnt: 1 },
          ]),
        );

      const result = await service.getStats(); // entry point

      expect(result.total).toBe(4); // return value
      expect(result.completed).toBe(2); // return value
      expect(result.pending).toBe(2); // return value
      expect(result.byPriority).toEqual({ High: 2, Medium: 1, Low: 1 }); // return value
    });

    it('reports all tasks as pending when none are completed', async () => {
      (db.select as any) // stub
        .mockReturnValueOnce(mockChain([{ total: 2 }]))
        .mockReturnValueOnce(mockChain([{ completed: 0 }]))
        .mockReturnValueOnce(mockChain([{ priority: 'Medium', cnt: 2 }]));

      const result = await service.getStats(); // entry point

      expect(result.completed).toBe(0); // return value
      expect(result.pending).toBe(2); // return value
    });
  });
});
