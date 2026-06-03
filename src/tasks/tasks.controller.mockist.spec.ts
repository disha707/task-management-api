/**
 * Unit tests for TasksController — Mockist (London) style.
 *
 * Approach:
 *   TasksService is replaced entirely by a mock object. Tests verify
 *   INTERACTIONS: that each handler calls the correct service method,
 *   forwards its arguments unchanged, and returns whatever the service
 *   returns — without exercising any real service logic.
 *
 *   Contrast with tasks.controller.unit.spec.ts (Classical):
 *   - Classical wires the real TasksService and asserts on return values.
 *   - Mockist mocks the service and asserts on which methods were called.
 *
 *   Trade-offs of the mockist approach:
 *   + Completely isolated — breaks on mismatched method signatures, not
 *     on underlying DB or business-logic bugs.
 *   + Pinpoints controller-layer bugs precisely.
 *   - Tests couple to method names; renaming a service method breaks the
 *     test even if behaviour is unchanged.
 *   - Does not catch wiring bugs where the controller calls the wrong
 *     service method but the names look plausible.
 *
 * Coverage:
 *   - getTasks: delegates to service.getTasks with the query DTO
 *   - getTaskById: delegates to service.getTaskById with the parsed id
 *   - createTask: delegates to service.createTask with the body DTO
 *   - updateTask: delegates to service.updateTask with id + body DTO
 *   - deleteTask: delegates to service.deleteTask with the parsed id
 *   - deleteTasksInBatch: delegates to service.deleteTasksInBatch with DTO
 *   - All handlers return exactly what the service returns (pass-through)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { GetTasksQueryDto } from './dto/get-tasks-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const mockService = {
  getTasks: vi.fn(),
  getTaskById: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  deleteTasksInBatch: vi.fn(),
};

const makeTask = (overrides = {}) => ({
  id: 1,
  title: 'Test task',
  description: null as string | null,
  completed: false,
  createdAt: new Date(),
  ...overrides,
});

describe('TasksController Unit Tests (Mockist)', () => {
  let controller: TasksController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: mockService }],
    }).compile();

    controller = module.get<TasksController>(TasksController);
  });

  // ─── getTasks ─────────────────────────────────────────────────────────────

  describe('getTasks', () => {
    it('calls service.getTasks with the query DTO and returns the result', async () => {
      const query: GetTasksQueryDto = { page: 2, limit: 5, search: 'drizzle' };
      const serviceResult = { data: [makeTask()], meta: { page: 2, limit: 5, total: 1, totalPages: 1 } };
      mockService.getTasks.mockResolvedValue(serviceResult);

      const result = await controller.getTasks(query);

      expect(mockService.getTasks).toHaveBeenCalledOnce();
      expect(mockService.getTasks).toHaveBeenCalledWith(query);
      expect(result).toBe(serviceResult);
    });

    it('does not call any other service method', async () => {
      mockService.getTasks.mockResolvedValue({ data: [], meta: {} });
      await controller.getTasks({});

      expect(mockService.getTaskById).not.toHaveBeenCalled();
      expect(mockService.createTask).not.toHaveBeenCalled();
    });
  });

  // ─── getTaskById ──────────────────────────────────────────────────────────

  describe('getTaskById', () => {
    it('calls service.getTaskById with the parsed id and returns the result', async () => {
      const task = makeTask({ id: 42 });
      mockService.getTaskById.mockResolvedValue(task);

      const result = await controller.getTaskById(42);

      expect(mockService.getTaskById).toHaveBeenCalledOnce();
      expect(mockService.getTaskById).toHaveBeenCalledWith(42);
      expect(result).toBe(task);
    });
  });

  // ─── createTask ───────────────────────────────────────────────────────────

  describe('createTask', () => {
    it('calls service.createTask with the body DTO and returns the created task', async () => {
      const dto: CreateTaskDto = { title: 'New task', description: 'Some info' };
      const created = makeTask({ title: 'New task', description: 'Some info' });
      mockService.createTask.mockResolvedValue(created);

      const result = await controller.createTask(dto);

      expect(mockService.createTask).toHaveBeenCalledOnce();
      expect(mockService.createTask).toHaveBeenCalledWith(dto);
      expect(result).toBe(created);
    });
  });

  // ─── updateTask ───────────────────────────────────────────────────────────

  describe('updateTask', () => {
    it('calls service.updateTask with id + DTO and returns the updated task', async () => {
      const dto: UpdateTaskDto = { title: 'Updated', completed: true };
      const updated = makeTask({ title: 'Updated', completed: true });
      mockService.updateTask.mockResolvedValue(updated);

      const result = await controller.updateTask(7, dto);

      expect(mockService.updateTask).toHaveBeenCalledOnce();
      expect(mockService.updateTask).toHaveBeenCalledWith(7, dto);
      expect(result).toBe(updated);
    });
  });

  // ─── deleteTask ───────────────────────────────────────────────────────────

  describe('deleteTask', () => {
    it('calls service.deleteTask with the parsed id and returns the deleted task', async () => {
      const task = makeTask({ id: 3 });
      mockService.deleteTask.mockResolvedValue(task);

      const result = await controller.deleteTask(3);

      expect(mockService.deleteTask).toHaveBeenCalledOnce();
      expect(mockService.deleteTask).toHaveBeenCalledWith(3);
      expect(result).toBe(task);
    });
  });

  // ─── deleteTasksInBatch ───────────────────────────────────────────────────

  describe('deleteTasksInBatch', () => {
    it('calls service.deleteTasksInBatch with the DTO and returns the deleted array', async () => {
      const dto: BulkDeleteDto = { ids: [1, 2, 3] };
      const deleted = [makeTask({ id: 1 }), makeTask({ id: 2 }), makeTask({ id: 3 })];
      mockService.deleteTasksInBatch.mockResolvedValue(deleted);

      const result = await controller.deleteTasksInBatch(dto);

      expect(mockService.deleteTasksInBatch).toHaveBeenCalledOnce();
      expect(mockService.deleteTasksInBatch).toHaveBeenCalledWith(dto);
      expect(result).toBe(deleted);
    });
  });
});
