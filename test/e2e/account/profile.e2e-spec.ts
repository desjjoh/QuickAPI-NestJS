import type { INestApplication } from '@nestjs/common';
import { getOptionsToken } from '@nestjs/throttler';
import { mkdir, rm, readdir } from 'node:fs/promises';
import { jest } from '@jest/globals';
import request from 'supertest';

import { env } from '@/config/environment.config';
import { CountryEntity } from '@/modules/domain/library/entities/country.entity';
import { GenderEntity } from '@/modules/domain/library/entities/gender.entity';
import { RegionEntity } from '@/modules/domain/library/entities/region.entity';
import { StorageService } from '@/modules/system/storage/types/storage.types';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { ImageEntity } from '@/modules/domain/media/entities/image.entity';
import { UserPhoneEntity } from '@/modules/domain/identity/entities/phone.entity';
import { UserAddressEntity } from '@/modules/domain/identity/entities/address.entity';
import { AuditEventEntity } from '@/modules/domain/audit/entities/audit-event.entity';
import { AuditService } from '@/modules/domain/audit/services/audit.service';
import { IdempotencyEntity } from '@/modules/system/idempotency/entities/idempotency.entity';
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
    jest.restoreAllMocks();
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
      .expect(413);
    expect(storage.objects.size).toBe(0);
  });

  it('replays avatar assignment/replacement/removal without repeated storage or audit work', async () => {
    const auth = await authenticated();
    const audits = suite.dataSource.getRepository(AuditEventEntity);
    const baseline = await audits.count();
    const put = jest.spyOn(storage, 'putObject');
    const remove = jest.spyOn(storage, 'deleteObject');
    const upload = (key: string, filename = 'avatar.png') =>
      auth.agent
        .post(`${ACCOUNT}/profile/avatar`)
        .set(auth.headers)
        .set('Idempotency-Key', key)
        .attach('avatar', PNG, filename);
    const first = await upload('assign').expect(201);
    expect((await upload('assign').expect(201)).body).toEqual(first.body);
    const second = await upload('replace').expect(201);
    expect((await upload('replace').expect(201)).body).toEqual(second.body);
    expect(put).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(await suite.dataSource.getRepository(ImageEntity).count()).toBe(1);
    expect(storage.objects.size).toBe(1);
    await upload('replace', 'changed.png').expect(409);
    const deletion = () =>
      auth.agent
        .delete(`${ACCOUNT}/profile/avatar`)
        .set(auth.headers)
        .set('Idempotency-Key', 'remove');
    const deleted = await deletion().expect(200);
    const newest = await upload('new-avatar').expect(201);
    expect((await deletion().expect(200)).body).toEqual(deleted.body);
    const persisted = await suite.dataSource
      .getRepository(UserEntity)
      .findOneByOrFail({ id: auth.user.id });
    expect(persisted.profile.media.avatar?.storage_key).toBe(
      newest.body.profile.media.avatar.storage_key,
    );
    expect(storage.objects.size).toBe(1);
    expect(put).toHaveBeenCalledTimes(3);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(await audits.count()).toBe(baseline + 4);
    expect(await readdir(env.UPLOAD_TMP_DIR)).toEqual([]);

    const snapshots = await suite.dataSource
      .getRepository(IdempotencyEntity)
      .find();
    expect(snapshots).toHaveLength(4);
    for (const snapshot of snapshots) {
      expect(snapshot.response_identity).toBe(auth.user.id);
      const body = snapshot.response_body as Record<string, unknown>;
      expect(body).not.toHaveProperty('access_token');
      expect(body).not.toHaveProperty('identity.password');
      expect(body).not.toHaveProperty('session.refresh');
      expect(body).not.toHaveProperty('session.token_version');
      expect(snapshot).not.toHaveProperty('request_body');
    }
    expect(JSON.stringify(snapshots)).not.toContain(auth.headers.authorization);
  });

  it.each(['phone', 'address'] as const)(
    'replays %s writes and never deletes a newly recreated contact on an old retry',
    async (kind) => {
      const auth = await authenticated();
      const country = await suite.dataSource
        .getRepository(CountryEntity)
        .findOneByOrFail({ iso2: 'CA' });
      const region = await suite.dataSource
        .getRepository(RegionEntity)
        .findOneByOrFail({ country: { id: country.id } });
      const payload =
        kind === 'phone'
          ? {
              phone_country_id: country.id,
              phone_calling_code: '+1',
              phone_national_number: '4165551234',
              phone_e164: '+14165551234',
            }
          : {
              address_line_1: '1 Test Street',
              address_line_2: null,
              city: 'Ottawa',
              region_id: region.id,
              postal_code: 'K1A 0B1',
              country_id: country.id,
            };
      const audits = suite.dataSource.getRepository(AuditEventEntity);
      const baseline = await audits.count();
      const write = (key: string, body: Record<string, unknown> = payload) =>
        auth.agent
          .post(`${ACCOUNT}/profile/${kind}`)
          .set(auth.headers)
          .set('Idempotency-Key', key)
          .send(body);
      const first = await write('set').expect(201);
      expect((await write('set').expect(201)).body).toEqual(first.body);
      const changed =
        kind === 'phone'
          ? {
              ...payload,
              phone_national_number: '6135559876',
              phone_e164: '+16135559876',
            }
          : { ...payload, city: 'Toronto' };
      await write('set', changed).expect(409);
      const updated = await write('update', changed).expect(201);
      expect((await write('update', changed).expect(201)).body).toEqual(
        updated.body,
      );
      const deletion = () =>
        auth.agent
          .delete(`${ACCOUNT}/profile/${kind}`)
          .set(auth.headers)
          .set('Idempotency-Key', 'remove');
      const deleted = await deletion().expect(200);
      const recreated = await write('recreate').expect(201);
      // AddressDto intentionally omits its database ID (PhoneDto exposes it).
      // Capture the recreated identity from persistence before replaying deletion.
      const recreatedUser = await suite.dataSource
        .getRepository(UserEntity)
        .findOneByOrFail({ id: auth.user.id });
      const recreatedContactId = recreatedUser.profile.contact[kind]?.id;
      expect(recreatedContactId).toEqual(expect.any(String));
      expect(recreated.body.profile.contact[kind]).not.toBeNull();
      expect((await deletion().expect(200)).body).toEqual(deleted.body);
      const user = await suite.dataSource
        .getRepository(UserEntity)
        .findOneByOrFail({ id: auth.user.id });
      expect(user.profile.contact[kind]?.id).toBe(recreatedContactId);
      expect(
        kind === 'phone'
          ? await suite.dataSource.getRepository(UserPhoneEntity).count()
          : await suite.dataSource.getRepository(UserAddressEntity).count(),
      ).toBe(1);
      expect(await audits.count()).toBe(baseline + 4);
    },
  );

  it('executes a concurrent avatar key once across database connections', async () => {
    const auth = await authenticated();
    const audits = suite.dataSource.getRepository(AuditEventEntity);
    const baseline = await audits.count();
    const put = jest.spyOn(storage, 'putObject');
    const upload = () =>
      auth.agent
        .post(`${ACCOUNT}/profile/avatar`)
        .set(auth.headers)
        .set('Idempotency-Key', 'concurrent')
        .attach('avatar', PNG, 'avatar.png');
    const responses = await Promise.all([upload(), upload()]);
    expect(
      responses.every((response) => [201, 409].includes(response.status)),
    ).toBe(true);
    const winner = responses.find((response) => response.status === 201);
    expect(winner).toBeDefined();
    expect((await upload().expect(201)).body).toEqual(winner!.body);
    expect(put).toHaveBeenCalledTimes(1);
    expect(storage.objects.size).toBe(1);
    expect(await suite.dataSource.getRepository(ImageEntity).count()).toBe(1);
    expect(await audits.count()).toBe(baseline + 1);
    expect(await readdir(env.UPLOAD_TMP_DIR)).toEqual([]);
  });

  it('compensates an avatar upload on audit failure and retries the rolled-back key safely', async () => {
    const auth = await authenticated();
    const upload = () =>
      auth.agent
        .post(`${ACCOUNT}/profile/avatar`)
        .set(auth.headers)
        .set('Idempotency-Key', 'rollback')
        .attach('avatar', PNG, 'avatar.png');
    jest
      .spyOn(app.get(AuditService), 'record')
      .mockRejectedValueOnce(new Error('simulated audit failure'));
    await upload().expect(500);
    expect(storage.objects.size).toBe(0);
    expect(await suite.dataSource.getRepository(ImageEntity).count()).toBe(0);
    expect(
      await suite.dataSource.getRepository(IdempotencyEntity).count(),
    ).toBe(0);
    expect(await readdir(env.UPLOAD_TMP_DIR)).toEqual([]);
    await upload().expect(201);
    expect(storage.objects.size).toBe(1);
  });

  it('keeps committed replacement and replay state when old-object cleanup exhausts retries', async () => {
    const auth = await authenticated();
    const upload = (key: string) =>
      auth.agent
        .post(`${ACCOUNT}/profile/avatar`)
        .set(auth.headers)
        .set('Idempotency-Key', key)
        .attach('avatar', PNG, 'avatar.png');
    const initial = await upload('cleanup-initial').expect(201);
    const oldKey = initial.body.profile.media.avatar.storage_key as string;
    const audits = suite.dataSource.getRepository(AuditEventEntity);
    const baseline = await audits.count();
    const put = jest.spyOn(storage, 'putObject');
    const remove = jest
      .spyOn(storage, 'deleteObject')
      .mockRejectedValue(new Error('storage unavailable'));
    await upload('cleanup-replacement').expect(500);
    const persisted = await suite.dataSource
      .getRepository(UserEntity)
      .findOneByOrFail({ id: auth.user.id });
    const newKey = persisted.profile.media.avatar!.storage_key;
    expect(newKey).not.toBe(oldKey);
    expect(storage.objects.has(newKey)).toBe(true);
    expect(storage.objects.has(oldKey)).toBe(true);
    expect(await suite.dataSource.getRepository(ImageEntity).count()).toBe(1);
    expect(await audits.count()).toBe(baseline + 1);
    expect(remove).toHaveBeenCalledTimes(3);
    const replay = await upload('cleanup-replacement').expect(201);
    expect(replay.body.profile.media.avatar.storage_key).toBe(newKey);
    expect(put).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(3);
    expect(await audits.count()).toBe(baseline + 1);
    expect(await readdir(env.UPLOAD_TMP_DIR)).toEqual([]);
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
