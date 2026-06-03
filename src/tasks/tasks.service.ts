import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, inArray, or, SQL } from 'drizzle-orm';

import { db } from '../db/db';
import { tasks } from '../db/schema';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { GetTasksQueryDto } from './dto/get-tasks-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  async getTasks(query: GetTasksQueryDto = {}) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      completed,
      priority,
    } = query;

    const conditions: SQL[] = [];

    if (search) {
      conditions.push(
        or(
          ilike(tasks.title, `%${search}%`),
          ilike(tasks.description, `%${search}%`),
        ) as SQL,
      );
    }

    if (completed !== undefined) {
      conditions.push(eq(tasks.completed, completed));
    }

    if (priority !== undefined) {
      conditions.push(eq(tasks.priority, priority));
    }

    const where = conditions.length ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(tasks)
      .where(where);

    const sortColumn =
      sortBy === 'title'
        ? tasks.title
        : sortBy === 'priority'
          ? tasks.priority
          : tasks.createdAt;
    const orderFn = sortOrder === 'asc' ? asc : desc;

    const data = await db
      .select()
      .from(tasks)
      .where(where)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTaskById(id: number) {
    const result = await db.select().from(tasks).where(eq(tasks.id, id));
    const task = result[0];

    if (!task) {
      throw new NotFoundException(`Task with id ${id} not found`);
    }

    return task;
  }

  async createTask(dto: CreateTaskDto) {
    const [newTask] = await db
      .insert(tasks)
      .values({
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
      })
      .returning();

    return newTask;
  }

  async updateTask(id: number, dto: UpdateTaskDto) {
    await this.getTaskById(id);

    const updateData: Record<string, unknown> = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.completed !== undefined) updateData.completed = dto.completed;
    if (dto.priority !== undefined) updateData.priority = dto.priority;

    const [updatedTask] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();

    return updatedTask;
  }

  async deleteTask(id: number) {
    const task = await this.getTaskById(id);
    await db.delete(tasks).where(eq(tasks.id, id));
    return task;
  }

  async getStats() {
    const [{ total }] = await db.select({ total: count() }).from(tasks);
    const [{ completed }] = await db
      .select({ completed: count() })
      .from(tasks)
      .where(eq(tasks.completed, true));

    const priorityRows = await db
      .select({ priority: tasks.priority, cnt: count() })
      .from(tasks)
      .groupBy(tasks.priority);

    const byPriority: { High: number; Medium: number; Low: number } = {
      High: 0,
      Medium: 0,
      Low: 0,
    };
    for (const row of priorityRows) {
      byPriority[row.priority] = row.cnt;
    }

    return { total, completed, pending: total - completed, byPriority };
  }

  async deleteTasksInBatch(dto: BulkDeleteDto) {
    const deletedTasks: (typeof tasks.$inferSelect)[] = [];

    await db.transaction(async (tx) => {
      for (const id of dto.ids) {
        const [task] = await tx.select().from(tasks).where(eq(tasks.id, id));
        if (!task) throw new NotFoundException(`Task with id ${id} not found`);
        deletedTasks.push(task);
      }

      await tx.delete(tasks).where(inArray(tasks.id, dto.ids));
    });

    return deletedTasks;
  }
}
