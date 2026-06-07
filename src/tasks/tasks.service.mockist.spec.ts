/**
 * Unit tests for TasksService — Mockist (London) style.
 *
 * Approach:
 *   The Drizzle `db` object is replaced by a mock and tests verify
 *   INTERACTIONS: that the service calls the correct db methods, builds
 *   the query chain correctly, and delegates the right arguments — without
 *   running any real business logic or assertions on computed values.
 *
 *   Contrast with tasks.service.unit.spec.ts (Classical):
 *   - Classical mocks db and asserts on return values / computed meta.
 *   - Mockist mocks db and asserts on which methods were called and how.
 *
 *   Trade-offs of the mockist approach:
 *   + Pinpoints exactly which db operation the service invokes.
 *   + Breaks immediately if the service changes the query strategy
 *     (e.g., adds an extra SELECT or swaps delete order).
 *   - Tests are tightly coupled to the implementation; internal refactors
 *     (e.g., combining two SELECTs into one) break tests with no user impact.
 *   - Does not verify that computed values (offsets, totalPages) are correct.
 *
 * Coverage:
 *   - getTasks: calls db.select exactly twice (count + data queries)
 *   - getTasks: applies offset based on page/limit
 *   - getTaskById: calls db.select once and returns its result
 *   - getTaskById: throws NotFoundException when db returns empty array
 *   - createTask: calls db.insert once and returns the inserted record
 *   - updateTask: calls getTaskById then db.update once
 *   - updateTask: does not call db.update when getTaskById throws
 *   - deleteTask: calls getTaskById then db.delete once
 *   - deleteTask: does not call db.delete when getTaskById throws
 *   - deleteTasksInBatch: runs inside db.transaction, calls db.delete N times
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';

vi.mock('../db/db', () => ({
  // mock
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

describe('TasksService Unit Tests (Mockist)', () => {
  let service: TasksService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TasksService();
  });

  // ─── Stub helpers ─────────────────────────────────────────────────────────
  //
  // stubGetTasks returns the dataChain so tests can assert on .offset.
  // stubBatchSelects sets up one sequential select per task for batch ops.

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

  function stubInsert(task: Task = makeTask()) {
    (db.insert as any).mockReturnValue(mockChain([task]));
  }

  function stubUpdate(task: Task = makeTask()) {
    (db.update as any).mockReturnValue(mockChain([task]));
  }

  function stubDelete() {
    (db.delete as any).mockReturnValue(mockChain(undefined));
  }

  function stubTransaction() {
    (db.transaction as any).mockImplementation(async (fn: Function) => fn(db));
  }

  function stubBatchSelects(...tasks: Array<Task | undefined>) {
    const mock = db.select as any;
    for (const task of tasks) {
      mock.mockReturnValueOnce(mockChain(task ? [task] : []));
    }
  }

  // ─── getTasks ─────────────────────────────────────────────────────────────

  describe('getTasks', () => {
    it('calls db.select exactly twice — once for count, once for data', async () => {
      stubGetTasks(1, [makeTask()]);

      await service.getTasks(); // entry point

      expect(db.select).toHaveBeenCalledTimes(2); // outgoing
    });

    it('does not call db.insert, db.update, or db.delete', async () => {
      stubGetTasks(0);

      await service.getTasks(); // entry point

      expect(db.insert).not.toHaveBeenCalled(); // outgoing
      expect(db.update).not.toHaveBeenCalled(); // outgoing
      expect(db.delete).not.toHaveBeenCalled(); // outgoing
    });

    it('applies offset = (page - 1) * limit to the data query', async () => {
      const dataChain = stubGetTasks(20);

      await service.getTasks({ page: 3, limit: 5 }); // entry point

      expect(dataChain.offset).toHaveBeenCalledWith(10); // outgoing
    });

    it('applies offset = 0 for page 1', async () => {
      const dataChain = stubGetTasks(5);

      await service.getTasks({ page: 1, limit: 10 }); // entry point

      expect(dataChain.offset).toHaveBeenCalledWith(0); // outgoing
    });

    it('calls db.select twice when priority filter is provided', async () => {
      stubGetTasks(1, [makeTask({ priority: 'Low' })]);

      await service.getTasks({ priority: 'Low' }); // entry point

      expect(db.select).toHaveBeenCalledTimes(2); // outgoing
    });

    it('calls db.select twice when sortBy is priority', async () => {
      stubGetTasks(2, [
        makeTask({ priority: 'High' }),
        makeTask({ id: 2, priority: 'Low' }),
      ]);

      await service.getTasks({ sortBy: 'priority', sortOrder: 'asc' }); // entry point

      expect(db.select).toHaveBeenCalledTimes(2); // outgoing
    });
  });

  // ─── getTaskById ──────────────────────────────────────────────────────────

  describe('getTaskById', () => {
    it('calls db.select exactly once', async () => {
      stubSelectOne(makeTask());

      await service.getTaskById(1); // entry point

      expect(db.select).toHaveBeenCalledTimes(1); // outgoing
    });

    it('does not call db.insert, db.update, or db.delete', async () => {
      stubSelectOne(makeTask());

      await service.getTaskById(1); // entry point

      expect(db.insert).not.toHaveBeenCalled(); // outgoing
      expect(db.update).not.toHaveBeenCalled(); // outgoing
      expect(db.delete).not.toHaveBeenCalled(); // outgoing
    });

    it('throws NotFoundException without calling other db methods when not found', async () => {
      stubSelectOne();

      await expect(service.getTaskById(999)).rejects.toThrow(NotFoundException); // entry point / return value
      expect(db.delete).not.toHaveBeenCalled(); // outgoing
    });
  });

  // ─── createTask ───────────────────────────────────────────────────────────

  describe('createTask', () => {
    it('calls db.insert exactly once', async () => {
      stubInsert();

      await service.createTask({ title: 'New task' }); // entry point

      expect(db.insert).toHaveBeenCalledTimes(1); // outgoing
    });

    it('does not call db.select, db.update, or db.delete', async () => {
      stubInsert();

      await service.createTask({ title: 'New task' }); // entry point

      expect(db.select).not.toHaveBeenCalled(); // outgoing
      expect(db.update).not.toHaveBeenCalled(); // outgoing
      expect(db.delete).not.toHaveBeenCalled(); // outgoing
    });

    it('calls db.insert once when priority is provided', async () => {
      stubInsert(makeTask({ priority: 'High' }));

      await service.createTask({ title: 'Urgent task', priority: 'High' }); // entry point

      expect(db.insert).toHaveBeenCalledTimes(1); // outgoing
      expect(db.select).not.toHaveBeenCalled(); // outgoing
    });

    it('calls db.insert once when priority is absent', async () => {
      stubInsert();

      await service.createTask({ title: 'No priority task' }); // entry point

      expect(db.insert).toHaveBeenCalledTimes(1); // outgoing
    });
  });

  // ─── updateTask ───────────────────────────────────────────────────────────

  describe('updateTask', () => {
    it('calls getTaskById then db.update exactly once', async () => {
      vi.spyOn(service, 'getTaskById').mockResolvedValue(makeTask()); // spy
      stubUpdate(makeTask({ title: 'Updated' }));

      await service.updateTask(1, { title: 'Updated' }); // entry point

      expect(service.getTaskById).toHaveBeenCalledOnce(); // outgoing
      expect(service.getTaskById).toHaveBeenCalledWith(1); // outgoing
      expect(db.update).toHaveBeenCalledTimes(1); // outgoing
    });

    it('does not call db.update when getTaskById throws NotFoundException', async () => {
      vi.spyOn(service, 'getTaskById').mockRejectedValue(
        new NotFoundException(),
      ); // spy

      await expect(service.updateTask(999, { title: 'X' })).rejects.toThrow(
        NotFoundException,
      ); // entry point / return value
      expect(db.update).not.toHaveBeenCalled(); // outgoing
    });

    it('calls db.update once when priority is provided in the DTO', async () => {
      vi.spyOn(service, 'getTaskById').mockResolvedValue(makeTask()); // spy
      stubUpdate(makeTask({ priority: 'Low' }));

      await service.updateTask(1, { priority: 'Low' }); // entry point

      expect(db.update).toHaveBeenCalledTimes(1); // outgoing
    });

    it('calls db.update once when priority is absent from the DTO', async () => {
      vi.spyOn(service, 'getTaskById').mockResolvedValue(
        makeTask({ priority: 'High' }),
      ); // spy
      stubUpdate(makeTask({ title: 'Renamed', priority: 'High' }));

      await service.updateTask(1, { title: 'Renamed' }); // entry point

      expect(db.update).toHaveBeenCalledTimes(1); // outgoing
    });
  });

  // ─── deleteTask ───────────────────────────────────────────────────────────

  describe('deleteTask', () => {
    it('calls getTaskById then db.delete exactly once', async () => {
      vi.spyOn(service, 'getTaskById').mockResolvedValue(makeTask()); // spy
      stubDelete();

      await service.deleteTask(1); // entry point

      expect(service.getTaskById).toHaveBeenCalledOnce(); // outgoing
      expect(service.getTaskById).toHaveBeenCalledWith(1); // outgoing
      expect(db.delete).toHaveBeenCalledTimes(1); // outgoing
    });

    it('does not call db.delete when getTaskById throws NotFoundException', async () => {
      vi.spyOn(service, 'getTaskById').mockRejectedValue(
        new NotFoundException(),
      ); // spy

      await expect(service.deleteTask(999)).rejects.toThrow(NotFoundException); // entry point / return value
      expect(db.delete).not.toHaveBeenCalled(); // outgoing
    });
  });

  // ─── deleteTasksInBatch ───────────────────────────────────────────────────

  describe('deleteTasksInBatch', () => {
    it('calls db.transaction exactly once', async () => {
      stubTransaction();
      stubBatchSelects(
        makeTask({ id: 1 }),
        makeTask({ id: 2, title: 'Task 2' }),
      );
      stubDelete();

      await service.deleteTasksInBatch({ ids: [1, 2] }); // entry point

      expect(db.transaction).toHaveBeenCalledTimes(1); // outgoing
    });

    it('calls db.delete exactly once for all ids (batch delete)', async () => {
      stubTransaction();
      stubBatchSelects(
        makeTask({ id: 1 }),
        makeTask({ id: 2, title: 'Task 2' }),
        makeTask({ id: 3, title: 'Task 3' }),
      );
      stubDelete();

      await service.deleteTasksInBatch({ ids: [1, 2, 3] }); // entry point

      expect(db.delete).toHaveBeenCalledTimes(1); // outgoing
    });

    it('throws NotFoundException without completing all deletes when an id is missing', async () => {
      stubTransaction();
      stubBatchSelects(makeTask({ id: 1 }), undefined); // undefined = id 999 not found
      stubDelete();

      await expect(
        service.deleteTasksInBatch({ ids: [1, 999] }),
      ).rejects.toThrow(NotFoundException); // entry point / return value
    });
  });
});
