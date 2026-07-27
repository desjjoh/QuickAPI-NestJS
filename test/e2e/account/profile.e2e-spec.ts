import type { INestApplication } from '@nestjs/common';
import { getOptionsToken } from '@nestjs/throttler';
import { mkdir, rm } from 'node:fs/promises';
import request from 'supertest';

import { env } from '@/config/environment.config';
import { CountryEntity } from '@/modules/domain/library/entities/country.entity';
import { GenderEntity } from '@/modules/domain/library/entities/gender.entity';
import { RegionEntity } from '@/modules/domain/library/entities/region.entity';
import { StorageService } from '@/modules/system/storage/types/storage.types';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { EmailService } from '@/modules/system/email/services/email.service';
import {
  acquireCsrf,
  CapturingEmailService,
  createRegisteredUser,
} from '../authentication/authentication-e2e.helpers';
import {
  setupTestSuite,
  teardownTestSuite,
  TestSuite,
} from '../../helpers/test-app';

const ACCOUNT = '/api/v1/account';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

class MemoryStorage extends StorageService {
  public readonly objects = new Map<string, Buffer>();
  async putObject(input: {
    key: string;
    body: Buffer | Uint8Array | string;
    contentType: string;
  }) {
    this.objects.set(input.key, Buffer.from(input.body));
    return {
      key: input.key,
      url: `memory://${input.key}`,
      contentType: input.contentType,
      sizeBytes: Buffer.byteLength(input.body),
    };
  }
  async deleteObject({ key }: { key: string }) {
    this.objects.delete(key);
  }
  async objectExists(key: string) {
    return this.objects.has(key);
  }
}

describe('authenticated account profile lifecycle', () => {
  let suite: TestSuite;
  let app: INestApplication;
  let email: CapturingEmailService;
  let storage: MemoryStorage;

  beforeAll(async () => {
    email = new CapturingEmailService();
    storage = new MemoryStorage();
    suite = await setupTestSuite((builder) =>
      builder
        .overrideProvider(EmailService)
        .useValue(email)
        .overrideProvider(StorageService)
        .useValue(storage)
        .overrideProvider(getOptionsToken())
        .useValue({
          skipIf: () => true,
          throttlers: [{ name: 'default', limit: 1, ttl: 60_000 }],
        }),
    );
    app = suite.app;
  });
  beforeEach(async () => {
    // Multer's disk storage requires its destination to exist. Recreate it
    // after the preceding test's cleanup instead of relying on a shared path.
    await mkdir(env.UPLOAD_TMP_DIR, { recursive: true });
  });
  afterEach(async () => {
    storage.objects.clear();
    email.clear();
    await rm(env.UPLOAD_TMP_DIR, { recursive: true, force: true });
    await suite.resetDatabase();
  });
  afterAll(async () => {
    await rm(env.UPLOAD_TMP_DIR, { recursive: true, force: true });
    await teardownTestSuite(suite);
  });

  async function authenticated() {
    const user = await createRegisteredUser(app, suite, email);
    const agent = request.agent(app.getHttpServer());
    const csrf = await acquireCsrf(agent);
    const response = await agent
      .post('/api/v1/authentication/sign-in')
      .set('x-csrf-token', csrf)
      .send({ email: 'person@example.test', password: 'Valid!Pass1' })
      .expect(201);
    const headers = {
      authorization: `Bearer ${response.body.access_token as string}`,
      'x-csrf-token': csrf,
    };
    return { user, agent, headers, response };
  }

  it('reads the authenticated profile and updates editable fields', async () => {
    const auth = await authenticated();
    expect(auth.response.body.user).toMatchObject({
      identity: { email: 'person@example.test' },
      profile: { name: { first: 'Pat' } },
    });
    const gender = await suite.dataSource
      .getRepository(GenderEntity)
      .findOneByOrFail({ key: 'female' });
    const updated = await auth.agent
      .patch(`${ACCOUNT}/profile`)
      .set(auth.headers)
      .send({
        first_name: 'Jane',
        last_name: 'Tester',
        preferred_name: null,
        dob: '1991-02-03',
        gender_id: gender.id,
        bio: 'E2E profile',
      })
      .expect(200);
    expect(updated.body.profile).toMatchObject({
      name: { first: 'Jane', last: 'Tester', preferred: null },
      personal: { bio: 'E2E profile' },
    });
    await auth.agent
      .patch(`${ACCOUNT}/profile`)
      .set(auth.headers)
      .send({ first_name: 7 })
      .expect(422);
  });

  it('creates, replaces, and removes phone and address records', async () => {
    const auth = await authenticated();
    const country = await suite.dataSource
      .getRepository(CountryEntity)
      .findOneByOrFail({ iso2: 'CA' });
    const region = await suite.dataSource
      .getRepository(RegionEntity)
      .findOneByOrFail({ country: { id: country.id } });
    const phone = (number: string) => ({
      phone_country_id: country.id,
      phone_calling_code: '+1',
      phone_national_number: number,
      phone_e164: `+1${number}`,
    });
    await auth.agent
      .post(`${ACCOUNT}/profile/phone`)
      .set(auth.headers)
      .send(phone('4165551234'))
      .expect(201);
    const replaced = await auth.agent
      .post(`${ACCOUNT}/profile/phone`)
      .set(auth.headers)
      .send(phone('6135559876'))
      .expect(201);
    expect(replaced.body.profile.contact.phone.phone_e164).toBe('+16135559876');
    await auth.agent
      .delete(`${ACCOUNT}/profile/phone`)
      .set(auth.headers)
      .expect(200);
    await auth.agent
      .post(`${ACCOUNT}/profile/phone`)
      .set(auth.headers)
      .send({ ...phone('abc'), phone_e164: 'bad' })
      .expect(422);

    const address = {
      address_line_1: '1 Test Street',
      address_line_2: null,
      city: 'Ottawa',
      region_id: region.id,
      postal_code: 'K1A 0B1',
      country_id: country.id,
    };
    await auth.agent
      .post(`${ACCOUNT}/profile/address`)
      .set(auth.headers)
      .send(address)
      .expect(201);
    const changed = await auth.agent
      .post(`${ACCOUNT}/profile/address`)
      .set(auth.headers)
      .send({ ...address, city: 'Toronto' })
      .expect(201);
    expect(changed.body.profile.contact.address.city).toBe('Toronto');
    await auth.agent
      .delete(`${ACCOUNT}/profile/address`)
      .set(auth.headers)
      .expect(200);
    await auth.agent
      .post(`${ACCOUNT}/profile/address`)
      .set(auth.headers)
      .send({ ...address, city: '' })
      .expect(422);
  });

  it('uploads, replaces, and removes an avatar without external storage', async () => {
    const auth = await authenticated();
    const first = await auth.agent
      .post(`${ACCOUNT}/profile/avatar`)
      .set(auth.headers)
      .attach('avatar', PNG, { filename: 'one.png', contentType: 'image/png' })
      .expect(201);
    const firstKey = first.body.profile.media.avatar.storage_key as string;
    expect(storage.objects.has(firstKey)).toBe(true);
    const second = await auth.agent
      .post(`${ACCOUNT}/profile/avatar`)
      .set(auth.headers)
      .attach('avatar', PNG, { filename: 'two.png', contentType: 'image/png' })
      .expect(201);
    const secondKey = second.body.profile.media.avatar.storage_key as string;
    expect(storage.objects.has(firstKey)).toBe(false);
    expect(storage.objects.has(secondKey)).toBe(true);
    await auth.agent
      .delete(`${ACCOUNT}/profile/avatar`)
      .set(auth.headers)
      .expect(200);
    expect(storage.objects.size).toBe(0);
  });

  it('rejects unsupported and oversized avatar files', async () => {
    const auth = await authenticated();
    await auth.agent
      .post(`${ACCOUNT}/profile/avatar`)
      .set(auth.headers)
      .attach('avatar', Buffer.from('text'), {
        filename: 'avatar.txt',
        contentType: 'text/plain',
      })
      .expect(400);
    await auth.agent
      .post(`${ACCOUNT}/profile/avatar`)
      .set(auth.headers)
      .attach('avatar', Buffer.alloc(1024 * 1024 + 1), {
        filename: 'huge.png',
        contentType: 'image/png',
      })
      .expect(400);
    expect(storage.objects.size).toBe(0);
  });

  it('requires authentication and permanently deletes the current account', async () => {
    await request(app.getHttpServer())
      .patch(`${ACCOUNT}/profile`)
      .send({})
      // The CSRF guard runs before JWT authentication on account routes.
      .expect(403);
    const auth = await authenticated();
    await auth.agent
      .post(`${ACCOUNT}/delete`)
      .set(auth.headers)
      .send({ password: 'wrong' })
      .expect(401);
    await auth.agent
      .post(`${ACCOUNT}/delete`)
      .set(auth.headers)
      .send({ password: 'Valid!Pass1' })
      .expect(204);
    expect(
      await suite.dataSource
        .getRepository(UserEntity)
        .findOneBy({ id: auth.user.id }),
    ).toBeNull();
  });
});
