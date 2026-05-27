import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { vi } from 'vitest';

describe('TasksController', () => {
  let controller: TasksController;

  const mockTasksService = {
    getTasks: vi.fn().mockReturnValue([
      {
        id: 1,
        title: 'Learn NestJS',
      },
    ]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: mockTasksService,
        },
      ],
    }).compile();

    controller = module.get<TasksController>(TasksController);
  });

  it('should return all tasks', async () => {
    await expect(controller.getTasks()).resolves.toEqual([
      {
        id: 1,
        title: 'Learn NestJS',
      },
    ]);
  });
});