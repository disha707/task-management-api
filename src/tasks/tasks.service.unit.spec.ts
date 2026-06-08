import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';

const dbRef = vi.hoisted(() => ({ current: null as any }));

vi.mock('../db/db', () => ({
  get db() {
    return dbRef.current;
  },
}));

import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;

  beforeAll(async () => {
    const client = new PGlite();
    dbRef.current = drizzle(client);

    await dbRef.current.execute(
      sql`DO $$ BEGIN CREATE TYPE task_priority AS ENUM ('High', 'Medium', 'Low'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    );
    await dbRef.current.execute(sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id          SERIAL PRIMARY KEY,
        title       VARCHAR(255) NOT NULL,
        description VARCHAR(1000),
        completed   BOOLEAN      NOT NULL DEFAULT false,
        created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
        priority    task_priority NOT NULL DEFAULT 'Medium'
      )
    `);
  });

  beforeEach(async () => {
    service = new TasksService();
    await dbRef.current.execute(sql`TRUNCATE tasks RESTART IDENTITY`);
  });

  // ─── getTasks ─────────────────────────────────────────────────────────────

  describe('getTasks', () => {
    it('returns paginated data with correct meta', async () => {
      await service.createTask({ title: 'Task 1' });

      const result = await service.getTasks();

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('returns correct totalPages when total exceeds limit', async () => {
      for (let i = 1; i <= 25; i++) {
        await service.createTask({ title: `Task ${i}` });
      }

      const result = await service.getTasks({ page: 1, limit: 10 });

      expect(result.meta.totalPages).toBe(3);
    });

    it('returns empty data when search term matches no tasks', async () => {
      await service.createTask({ title: 'Buy groceries' });

      const result = await service.getTasks({ search: 'xyz_no_match' });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('returns only completed tasks when completed filter is true', async () => {
      await service.createTask({ title: 'Pending task' });
      const toComplete = await service.createTask({ title: 'To complete' });
      await service.updateTask(toComplete.id, { completed: true });

      const result = await service.getTasks({ completed: true });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].completed).toBe(true);
    });

    it('returns only matching tasks when priority filter is provided', async () => {
      await service.createTask({ title: 'High task', priority: 'High' });
      await service.createTask({ title: 'Low task', priority: 'Low' });

      const result = await service.getTasks({ priority: 'Low' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].priority).toBe('Low');
    });

    it('returns all tasks when no filter is applied', async () => {
      await service.createTask({ title: 'High task', priority: 'High' });
      await service.createTask({ title: 'Low task', priority: 'Low' });

      const result = await service.getTasks({});

      expect(result.data).toHaveLength(2);
    });

    it('sorts tasks by priority ascending', async () => {
      await service.createTask({ title: 'Low task', priority: 'Low' });
      await service.createTask({ title: 'High task', priority: 'High' });

      const result = await service.getTasks({
        sortBy: 'priority',
        sortOrder: 'asc',
      });

      expect(result.data[0].priority).toBe('High');
      expect(result.data[1].priority).toBe('Low');
    });

    it('returns correct meta for page 2 with limit 5', async () => {
      for (let i = 1; i <= 20; i++) {
        await service.createTask({ title: `Task ${i}` });
      }

      const result = await service.getTasks({ page: 2, limit: 5 });

      expect(result.meta).toEqual({
        page: 2,
        limit: 5,
        total: 20,
        totalPages: 4,
      });
      expect(result.data).toHaveLength(5);
    });
  });

  // ─── getTaskById ──────────────────────────────────────────────────────────

  describe('getTaskById', () => {
    it('returns the task when found', async () => {
      const created = await service.createTask({ title: 'Test task' });

      const result = await service.getTaskById(created.id);

      expect(result).toEqual(created);
    });

    it('throws NotFoundException when task does not exist', async () => {
      await expect(service.getTaskById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── createTask ───────────────────────────────────────────────────────────

  describe('createTask', () => {
    it('returns a new task with the given title', async () => {
      const result = await service.createTask({ title: 'New task' });

      expect(result.title).toBe('New task');
      expect(result.id).toBeDefined();
    });

    it('persists description when provided', async () => {
      const result = await service.createTask({
        title: 'With desc',
        description: 'Some info',
      });

      expect(result.description).toBe('Some info');
    });

    it('stores the given priority', async () => {
      const result = await service.createTask({
        title: 'Urgent',
        priority: 'High',
      });

      expect(result.priority).toBe('High');
    });

    it('defaults to Medium priority when none is provided', async () => {
      const result = await service.createTask({
        title: 'Default priority task',
      });

      expect(result.priority).toBe('Medium');
    });
  });

  // ─── updateTask ───────────────────────────────────────────────────────────

  describe('updateTask', () => {
    it('updates task title', async () => {
      const task = await service.createTask({ title: 'Old' });

      const result = await service.updateTask(task.id, { title: 'New' });

      expect(result.title).toBe('New');
    });

    it('updates completed status', async () => {
      const task = await service.createTask({ title: 'Task' });

      const result = await service.updateTask(task.id, { completed: true });

      expect(result.completed).toBe(true);
    });

    it('updates description', async () => {
      const task = await service.createTask({ title: 'Task' });

      const result = await service.updateTask(task.id, {
        description: 'Updated desc',
      });

      expect(result.description).toBe('Updated desc');
    });

    it('updates priority', async () => {
      const task = await service.createTask({ title: 'Task' });

      const result = await service.updateTask(task.id, { priority: 'Low' });

      expect(result.priority).toBe('Low');
    });

    it('leaves priority unchanged when not in the update payload', async () => {
      const task = await service.createTask({
        title: 'Task',
        priority: 'High',
      });

      const result = await service.updateTask(task.id, { title: 'Renamed' });

      expect(result.priority).toBe('High');
    });

    it('throws NotFoundException when task does not exist', async () => {
      await expect(service.updateTask(999, { title: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── deleteTask ───────────────────────────────────────────────────────────

  describe('deleteTask', () => {
    it('deletes the task and returns it', async () => {
      const task = await service.createTask({ title: 'To delete' });

      const result = await service.deleteTask(task.id);

      expect(result).toEqual(task);
      await expect(service.getTaskById(task.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when task does not exist', async () => {
      await expect(service.deleteTask(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteTasksInBatch ───────────────────────────────────────────────────

  describe('deleteTasksInBatch', () => {
    it('deletes multiple tasks and returns them', async () => {
      const t1 = await service.createTask({ title: 'Task 1' });
      const t2 = await service.createTask({ title: 'Task 2' });

      const result = await service.deleteTasksInBatch({ ids: [t1.id, t2.id] });

      expect(result).toHaveLength(2);
      await expect(service.getTaskById(t1.id)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getTaskById(t2.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException and rolls back when a task is not found', async () => {
      const task = await service.createTask({ title: 'Task 1' });

      await expect(
        service.deleteTasksInBatch({ ids: [task.id, 999] }),
      ).rejects.toThrow(NotFoundException);

      await expect(service.getTaskById(task.id)).resolves.toBeDefined();
    });
  });

  // ─── getStats ─────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns zero counts when there are no tasks', async () => {
      const result = await service.getStats();

      expect(result).toEqual({
        total: 0,
        completed: 0,
        pending: 0,
        byPriority: { High: 0, Medium: 0, Low: 0 },
      });
    });

    it('returns correct totals and priority breakdown for a mixed set', async () => {
      const h1 = await service.createTask({ title: 'H1', priority: 'High' });
      const h2 = await service.createTask({ title: 'H2', priority: 'High' });
      await service.createTask({ title: 'M1', priority: 'Medium' });
      await service.createTask({ title: 'L1', priority: 'Low' });
      await service.updateTask(h1.id, { completed: true });
      await service.updateTask(h2.id, { completed: true });

      const result = await service.getStats();

      expect(result.total).toBe(4);
      expect(result.completed).toBe(2);
      expect(result.pending).toBe(2);
      expect(result.byPriority).toEqual({ High: 2, Medium: 1, Low: 1 });
    });

    it('reports all tasks as pending when none are completed', async () => {
      await service.createTask({ title: 'M1', priority: 'Medium' });
      await service.createTask({ title: 'M2', priority: 'Medium' });

      const result = await service.getStats();

      expect(result.completed).toBe(0);
      expect(result.pending).toBe(2);
    });
  });
});
