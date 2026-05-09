import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp } from '../helpers/test-app';

describe('Readiness endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /ready returns 200', async () => {
    await request(app.getHttpServer()).get('/ready').expect(200);
  });
});
