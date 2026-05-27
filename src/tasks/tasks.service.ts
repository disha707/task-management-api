import { Injectable } from '@nestjs/common';
import { db } from '../db/db';
import { tasks } from '../db/schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { eq } from 'drizzle-orm';
import { NotFoundException } from '@nestjs/common';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  async getTasks() {
    return db.select().from(tasks);
  }

  async getTaskById(id: number) {
    const result = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, id));

    const task = result[0];

    if (!task) {
        throw new NotFoundException('Task not found');
    }

    return task;
    }

  async createTask(dto: CreateTaskDto) {
    const [newTask] = await db
      .insert(tasks)
      .values({
        title: dto.title,
      })
      .returning();

    return newTask;
  }

  async deleteTask(id: number) {
    const task = await this.getTaskById(id);

    await db
        .delete(tasks)
        .where(eq(tasks.id, id));

    return task;
  }

  async updateTask(
    id: number,
    dto: UpdateTaskDto,
    ) {
    await this.getTaskById(id);

    const [updatedTask] = await db
        .update(tasks)
        .set({
        title: dto.title,
        })
        .where(eq(tasks.id, id))
        .returning();

    return updatedTask;
  }
}