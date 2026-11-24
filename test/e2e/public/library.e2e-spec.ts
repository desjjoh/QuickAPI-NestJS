import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  setupTestSuite,
  teardownTestSuite,
  TestSuite,
} from '../../helpers/test-app';

describe('public library API', () => {
  let app: INestApplication;
  let suite: TestSuite;

  beforeAll(async () => {
    suite = await setupTestSuite();
    app = suite.app;
  });

  afterAll(async () => teardownTestSuite(suite));

  it('returns the same three collections from the public startup route', async () => {
    const server = app.getHttpServer();
    const [startup, countries, genders, timezones] = await Promise.all([
      request(server).get('/api/v1/public/library/startup').expect(200),
      request(server).get('/api/v1/public/library/countries').expect(200),
      request(server).get('/api/v1/public/library/genders').expect(200),
      request(server).get('/api/v1/public/library/timezones').expect(200),
    ]);

    expect(startup.body).toEqual({
      countries: countries.body,
      genders: genders.body,
      timezones: timezones.body,
    });
  });

  it.each(['countries', 'timezones', 'genders'])(
    'keeps GET /api/v1/public/library/%s public with seeded reference DTOs',
    async (collection) => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/public/library/${collection}`)
        .expect(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          key: expect.any(String),
          label: expect.any(String),
        }),
      );
    },
  );

  it.each(['roles', 'statuses'])(
    'returns 404 for the retired public library route /%s',
    async (collection) => {
      await request(app.getHttpServer())
        .get(`/api/v1/public/library/${collection}`)
        .expect(404);
    },
  );
});
