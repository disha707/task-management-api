import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('Tasks Integration Tests', () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.DATABASE_URL =
      'postgresql://postgres:password@localhost:5432/tasksdb_test';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should create and fetch tasks', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/tasks')
      .send({
        title: 'Integration Task',
      });

    expect(createResponse.status).toBe(201);

    const getResponse = await request(app.getHttpServer())
      .get('/tasks');

    expect(getResponse.status).toBe(200);

    expect(Array.isArray(getResponse.body)).toBe(true);
  });
});