import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from '../db/db';
import { TasksService } from './tasks.service';

describe('TasksService Mock Tests', () => {
  let service: TasksService;

  beforeEach(() => {
    service = new TasksService();
  });

  it('should return mocked tasks', async () => {
    const mockedTasks = [
      {
        id: 1,
        title: 'Mocked Task',
      },
    ];

    const fromMock = vi.fn().mockResolvedValue(mockedTasks);

    (db.select as any).mockReturnValue({
      from: fromMock,
    });

    const result = await service.getTasks();

    expect(result).toEqual(mockedTasks);
  });
});