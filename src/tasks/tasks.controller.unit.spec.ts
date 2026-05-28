/**
 * Unit tests for TasksController.
 *
 * Scope:
 *   These tests verify that each route handler delegates to the correct
 *   TasksService method with the correct arguments and passes through whatever
 *   the service returns.  TasksService is replaced by a mock object, so
 *   there is no database, no HTTP server, and no NestJS request pipeline
 *   (no ValidationPipe, no ParseIntPipe, no guards).
 *
 * What coverage do we get from this set of tests?
 *   - Wiring: every handler calls the right service method (not a neighbour)
 *   - Argument forwarding: parsed id and DTO objects reach the service unchanged
 *   - Return value pass-through: the handler returns exactly what the service returns
 *
 * What is NOT covered here (and where it IS covered):
 *   - HTTP status codes, headers, and body serialisation
 *       → tasks.service.integration.spec.ts (real NestJS pipeline + real DB)
 *   - Request validation (class-validator, ParseIntPipe) — same file above
 *   - Business rules and database behaviour — same file above
 */

import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { GetTasksQueryDto } from './dto/get-tasks-query.dto';
import { BulkDeleteDto } from './dto/bulk-delete.dto';

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

describe('TasksController Unit Tests', () => {
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
    it('calls service.getTasks with the query object and returns the result', async () => {
      const query: GetTasksQueryDto = { page: 2, limit: 5, search: 'drizzle' };
      const serviceResult = { data: [makeTask()], meta: { page: 2, limit: 5, total: 1, totalPages: 1 } };
      mockService.getTasks.mockResolvedValue(serviceResult);

      const result = await controller.getTasks(query);

      expect(mockService.getTasks).toHaveBeenCalledOnce();
      expect(mockService.getTasks).toHaveBeenCalledWith(query);
      expect(result).toBe(serviceResult);
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
    it('calls service.createTask with the DTO and returns the created task', async () => {
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
    it('calls service.updateTask with the parsed id and DTO, returns the updated task', async () => {
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
    it('calls service.deleteTasksInBatch with the DTO and returns the deleted tasks array', async () => {
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
