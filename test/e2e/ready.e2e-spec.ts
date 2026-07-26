import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { LC } from '@/common/handlers/lifecycle.handler';
import { TypeOrmService } from '@/modules/system/database/services/typeorm.service';
import { createTestApp } from '../helpers/test-app';

describe('Readiness endpoint', () => {
  let app: INestApplication;
  let database: TypeOrmService;

  beforeAll(async () => {
    app = await createTestApp();
    database = app.get(TypeOrmService);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await app.close();
  });

  it('GET /ready returns 200 when all readiness checks pass', async () => {
    jest.spyOn(LC, 'isReady').mockReturnValue(true);
    jest.spyOn(LC, 'areAllServicesHealthy').mockResolvedValue(true);
    jest.spyOn(database, 'get_status').mockResolvedValue('connected');

    const response = await request(app.getHttpServer())
      .get('/ready')
      .expect(200);

    expect(response.body).toMatchObject({
      ready: true,
      status: 'ready',
      checks: [
        { name: 'lifecycle', status: 'up' },
        { name: 'database', status: 'up' },
      ],
    });
  });

  it('GET /ready returns 503 when the database check fails', async () => {
    jest.spyOn(LC, 'isReady').mockReturnValue(true);
    jest.spyOn(LC, 'areAllServicesHealthy').mockResolvedValue(true);
    jest.spyOn(database, 'get_status').mockResolvedValue('disconnected');

    const response = await request(app.getHttpServer())
      .get('/ready')
      .expect(503);

    expect(response.body).toMatchObject({
      ready: false,
      status: 'not_ready',
      checks: [
        { name: 'lifecycle', status: 'up' },
        { name: 'database', status: 'down' },
      ],
    });
  });

  it('GET /ready returns 503 when a lifecycle check fails', async () => {
    jest.spyOn(LC, 'isReady').mockReturnValue(true);
    jest.spyOn(LC, 'areAllServicesHealthy').mockResolvedValue(false);
    jest.spyOn(database, 'get_status').mockResolvedValue('connected');

    const response = await request(app.getHttpServer())
      .get('/ready')
      .expect(503);

    expect(response.body).toMatchObject({
      ready: false,
      status: 'not_ready',
      checks: [
        { name: 'lifecycle', status: 'down' },
        { name: 'database', status: 'up' },
      ],
    });
  });
});
