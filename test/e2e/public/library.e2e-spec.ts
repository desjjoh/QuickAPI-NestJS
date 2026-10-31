import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  setupTestSuite,
  teardownTestSuite,
  TestSuite,
} from '../../helpers/test-app';

describe('library API after identity reference ownership split', () => {
  let app: INestApplication;
  let suite: TestSuite;

  beforeAll(async () => {
    suite = await setupTestSuite();
    app = suite.app;
  });

  afterAll(async () => teardownTestSuite(suite));

  it.each(['countries', 'timezones', 'genders', 'roles', 'statuses'])(
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
      if (collection === 'roles') {
        expect(response.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              key: 'user',
              permissions: expect.any(Array),
            }),
          ]),
        );
      }
      if (collection === 'statuses') {
        expect(response.body).toEqual(
          expect.arrayContaining([expect.objectContaining({ key: 'deleted' })]),
        );
      }
    },
  );
});
