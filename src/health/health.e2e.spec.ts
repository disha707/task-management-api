/**
 * E2E tests for the health check endpoint.
 *
 * GET /health is intentionally public (no JWT guard) so load balancers
 * and container orchestrators can probe liveness without credentials.
 *
 * Coverage:
 *   - Returns 200 with { status: 'ok' } and a numeric timestamp
 *   - Does NOT require an Authorization header
 */

import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';

describe('Health check', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /health → 200 with { status: "ok" } and a timestamp', async () => {
    const res = await request(app.getHttpServer()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('number');
  });

  it('GET /health → 200 without Authorization header (public endpoint)', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
  });
});
