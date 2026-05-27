import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TasksService],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('should return all tasks', async () => {
    const result = await service.getTasks();

    expect(Array.isArray(result)).toBe(true);
  });

  it('should create a task', async () => {
    const newTask = await service.createTask({
      title: 'Learn Drizzle',
    });

    expect(newTask.title).toBe('Learn Drizzle');
  });

  it('should return task by id', async () => {
    const createdTask = await service.createTask({
      title: 'Learn Drizzle',
    });

    const task = await service.getTaskById(createdTask.id);

    expect(task).toEqual(createdTask);
  });

  it('should throw if task does not exist', async () => {
    await expect(service.getTaskById(999))
      .rejects
      .toThrow('Task not found');
  });
  
  it('should delete a task', async () => {
    const createdTask = await service.createTask({
      title: 'Task to delete',
    });

    await service.deleteTask(createdTask.id);

    await expect(service.getTaskById(createdTask.id))
      .rejects
      .toThrow('Task not found');
  });

  it('should throw when deleting non-existing task', async () => {
    await expect(service.deleteTask(999))
      .rejects
      .toThrow('Task not found');
  });

  it('should update a task', async () => {
    const createdTask = await service.createTask({
      title: 'Old title',
    });

    const updatedTask = await service.updateTask(
      createdTask.id,
      {
        title: 'New title',
      },
    );

    expect(updatedTask.title).toBe('New title');
  });

  it('should throw when updating non-existing task', async () => {
    await expect(
      service.updateTask(999, {
        title: 'Updated',
      }),
    ).rejects.toThrow('Task not found');
  });
});