import type { INestApplication } from '@nestjs/common';
import { getOptionsToken } from '@nestjs/throttler';
import { mkdir, rm, readdir } from 'node:fs/promises';
import { jest } from '@jest/globals';
import request from 'supertest';
import sharp from 'sharp';
import { ImageProcessingService } from '@/modules/system/image-processing/services/image-processing.service';
import { ImageProcessingError } from '@/modules/system/image-processing/types/image-processing.types';

import { env } from '@/config/environment.config';
import { CountryEntity } from '@/modules/domain/library/entities/country.entity';
import { GenderEntity } from '@/modules/domain/identity/entities/gender.entity';
import { RegionEntity } from '@/modules/domain/library/entities/region.entity';
import { TimezoneEntity } from '@/modules/domain/library/entities/time-zone.entity';
import { IdentityAuditEvents } from '@/config/audit-events.config';
import { StorageService } from '@/modules/system/storage/types/storage.types';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { ImageEntity } from '@/modules/domain/media/entities/image.entity';
import { UserPhoneEntity } from '@/modules/domain/identity/entities/phone.entity';
import { UserAddressEntity } from '@/modules/domain/identity/entities/address.entity';
import { AuditEventEntity } from '@/modules/domain/audit/entities/audit-event.entity';
import { AuditService } from '@/modules/domain/audit/services/audit.service';
import { IdempotencyEntity } from '@/modules/system/idempotency/entities/idempotency.entity';
import { StorageDeletionIntentEntity } from '@/modules/system/storage-cleanup/entities/storage-deletion-intent.entity';
import { StorageObjectEntity } from '@/modules/system/storage/entities/storage-object.entity';
import { StorageCleanupService } from '@/modules/system/storage-cleanup/services/storage-cleanup.service';
import { STORAGE_CLEANUP_ATTEMPTS } from '@/modules/system/storage-cleanup/queues/storage-cleanup.queue';
import { drainStorageCleanup } from '../../helpers/storage-cleanup';
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

  const profileState = (user: UserEntity) => ({
    name: user.profile.name,
    personal: {
      dob: user.profile.personal.dob,
      bio: user.profile.personal.bio,
      gender: user.profile.personal.gender?.id,
    },
    country: user.profile.region.country.id,
    timezone: user.profile.region.timezone.key,
    metadata: user.metadata,
    version: user.administration_version,
  });

  async function setting(
    kind: 'details' | 'country' | 'timezone',
    user: UserEntity,
  ) {
    if (kind === 'details') {
      const genders = await suite.dataSource.getRepository(GenderEntity).find();
      const first = genders.find(
        (gender) => gender.id !== user.profile.personal.gender?.id,
      )!;
      const later = genders.find((gender) => gender.id !== first.id)!;
      const body = {
        first_name: 'First',
        last_name: 'Tester',
        preferred_name: null,
        dob: '1991-02-03',
        gender_id: first.id,
        bio: 'First profile',
      };

      return {
        method: 'patch' as const,
        suffix: '',
        first: body,
        later: { ...body, first_name: 'Later', gender_id: later.id },
        event: IdentityAuditEvents.PROFILE_PERSONAL_INFORMATION_CHANGED,
      };
    }
    if (kind === 'country') {
      const countries = await suite.dataSource
        .getRepository(CountryEntity)
        .find();
      const first = countries.find(
        (country) => country.id !== user.profile.region.country.id,
      )!;
      const later = countries.find((country) => country.id !== first.id)!;

      return {
        method: 'put' as const,
        suffix: '/country',
        first: { country_id: first.id },
        later: { country_id: later.id },
        event: IdentityAuditEvents.PROFILE_COUNTRY_CHANGED,
      };
    }
    const timezones = await suite.dataSource
      .getRepository(TimezoneEntity)
      .find({ take: 3, order: { key: 'ASC' } });
    const first = timezones.find(
      (timezone) => timezone.key !== user.profile.region.timezone.key,
    )!;
    const later = timezones.find((timezone) => timezone.key !== first.key)!;

    return {
      method: 'put' as const,
      suffix: '/timezone',
      first: { timezone_id: first.id },
      later: { timezone_id: later.id },
      event: IdentityAuditEvents.PROFILE_TIMEZONE_CHANGED,
    };
  }

  it.each(['details', 'country', 'timezone'] as const)(
    'replays %s updates without undoing a newer setting or duplicating audits',
    async (kind) => {
      const auth = await authenticated();
      const mutation = await setting(kind, auth.user);
      const users = suite.dataSource.getRepository(UserEntity);
      const send = (key: string, body: object) =>
        auth.agent[mutation.method](`${ACCOUNT}/profile${mutation.suffix}`)
          .set(auth.headers)
          .set('Idempotency-Key', key)
          .send(body);
      const original = await send('setting-first', mutation.first).expect(200);
      await send('setting-later', mutation.later).expect(200);
      const latest = profileState(
        await users.findOneByOrFail({ id: auth.user.id }),
      );

      expect(
        (await send('setting-first', mutation.first).expect(200)).body,
      ).toEqual(original.body);
      await send('setting-first', mutation.later).expect(409);
      expect(
        profileState(await users.findOneByOrFail({ id: auth.user.id })),
      ).toEqual(latest);
      const events = await suite.dataSource
        .getRepository(AuditEventEntity)
        .findBy({ event: mutation.event, actor_id: auth.user.id });

      expect(events).toHaveLength(2);
      expect(events.map((event) => event.idempotency_key).sort()).toEqual([
        'setting-first',
        'setting-later',
      ]);
      expect(
        await suite.dataSource.getRepository(IdempotencyEntity).count(),
      ).toBe(2);
    },
  );

  it.each(['details', 'country', 'timezone'] as const)(
    'rechecks permissions before replaying a cached %s update',
    async (kind) => {
      const auth = await authenticated();
      const mutation = await setting(kind, auth.user);
      const send = () =>
        auth.agent[mutation.method](`${ACCOUNT}/profile${mutation.suffix}`)
          .set(auth.headers)
          .set('Idempotency-Key', 'permission-retry')
          .send(mutation.first);

      await send().expect(200);
      const current = await suite.dataSource
        .getRepository(UserEntity)
        .findOneByOrFail({ id: auth.user.id });
      await suite.dataSource
        .createQueryBuilder()
        .relation(UserEntity, 'roles')
        .of(current.id)
        .remove(current.roles!.map((role) => role.id));
      await send().expect(403);

      expect(
        await suite.dataSource.getRepository(IdempotencyEntity).count(),
      ).toBe(1);
      expect(
        await suite.dataSource
          .getRepository(AuditEventEntity)
          .countBy({ event: mutation.event, actor_id: auth.user.id }),
      ).toBe(1);
    },
  );

  it('checks account-update permission for phone writes and cached phone replay', async () => {
    const auth = await authenticated();
    const country = await suite.dataSource
      .getRepository(CountryEntity)
      .findOneByOrFail({ key: 'canada' });
    const body = {
      phone_country_id: country.id,
      phone_calling_code: '+1',
      phone_national_number: '4165551234',
      phone_e164: '+14165551234',
    };
    const send = () =>
      auth.agent
        .post(`${ACCOUNT}/profile/phone`)
        .set(auth.headers)
        .set('Idempotency-Key', 'phone-permission')
        .send(body);

    await send().expect(201);
    const current = await suite.dataSource
      .getRepository(UserEntity)
      .findOneByOrFail({ id: auth.user.id });
    await suite.dataSource
      .createQueryBuilder()
      .relation(UserEntity, 'roles')
      .of(current.id)
      .remove(current.roles!.map((role) => role.id));
    await send().expect(403);
    await auth.agent
      .delete(`${ACCOUNT}/profile/phone`)
      .set(auth.headers)
      .expect(403);

    expect(await suite.dataSource.getRepository(UserPhoneEntity).count()).toBe(
      1,
    );
    expect(
      await suite.dataSource.getRepository(IdempotencyEntity).count(),
    ).toBe(1);
  });

  it.each(
    (['details', 'country', 'timezone'] as const).flatMap((kind) =>
      [false, true].map((keyed) => [kind, keyed] as const),
    ),
  )(
    'rolls back %s reference changes with failed audits and permits retry (keyed=%s)',
    async (kind, keyed) => {
      const auth = await authenticated();
      const mutation = await setting(kind, auth.user);
      const users = suite.dataSource.getRepository(UserEntity);
      const before = profileState(
        await users.findOneByOrFail({ id: auth.user.id }),
      );
      const audit = app.get(AuditService);
      const failure = jest
        .spyOn(audit, 'record')
        .mockRejectedValueOnce(new Error('injected audit failure'));
      const send = () => {
        const pending = auth.agent[mutation.method](
          `${ACCOUNT}/profile${mutation.suffix}`,
        ).set(auth.headers);

        if (keyed) pending.set('Idempotency-Key', 'setting-retry');

        return pending.send(mutation.first);
      };

      await send().expect(500);
      failure.mockRestore();
      expect(
        profileState(await users.findOneByOrFail({ id: auth.user.id })),
      ).toEqual(before);
      expect(
        await suite.dataSource
          .getRepository(AuditEventEntity)
          .countBy({ event: mutation.event, actor_id: auth.user.id }),
      ).toBe(0);
      expect(
        await suite.dataSource.getRepository(IdempotencyEntity).count(),
      ).toBe(0);

      await send().expect(200);
      expect(
        profileState(await users.findOneByOrFail({ id: auth.user.id })),
      ).not.toEqual(before);
      expect(
        await suite.dataSource
          .getRepository(AuditEventEntity)
          .countBy({ event: mutation.event, actor_id: auth.user.id }),
      ).toBe(1);
      expect(
        await suite.dataSource.getRepository(IdempotencyEntity).count(),
      ).toBe(keyed ? 1 : 0);
    },
  );

  it.each(['America/Toronto', 'not-an-id', ''])(
    'rejects malformed timezone IDs without a mutation or replay claim: %s',
    async (timezone_id) => {
      const auth = await authenticated();
      const users = suite.dataSource.getRepository(UserEntity);
      const before = profileState(
        await users.findOneByOrFail({ id: auth.user.id }),
      );

      await auth.agent
        .put(`${ACCOUNT}/profile/timezone`)
        .set(auth.headers)
        .set('Idempotency-Key', 'invalid-timezone')
        .send({ timezone_id })
        .expect(422);

      expect(
        profileState(await users.findOneByOrFail({ id: auth.user.id })),
      ).toEqual(before);
      expect(
        await suite.dataSource.getRepository(IdempotencyEntity).count(),
      ).toBe(0);
      expect(
        await suite.dataSource.getRepository(AuditEventEntity).countBy({
          actor_id: auth.user.id,
          event: IdentityAuditEvents.PROFILE_TIMEZONE_CHANGED,
        }),
      ).toBe(0);
    },
  );

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
    const stored = storage.objects.get(firstKey)!;
    expect(firstKey).toMatch(/\.webp$/);
    expect(await sharp(stored).metadata()).toMatchObject({
      format: 'webp',
      width: 256,
      height: 256,
    });
    expect(
      await suite.dataSource.getRepository(ImageEntity).findOneByOrFail({
        storage_key: firstKey,
      }),
    ).toMatchObject({
      width: 256,
      height: 256,
      size_bytes: stored.length,
      mime_type: 'image/webp',
    });
    const second = await auth.agent
      .post(`${ACCOUNT}/profile/avatar`)
      .set(auth.headers)
      .attach('avatar', PNG, { filename: 'two.png', contentType: 'image/png' })
      .expect(201);
    const secondKey = second.body.profile.media.avatar.storage_key as string;
    expect(storage.objects.has(firstKey)).toBe(true);
    await drainStorageCleanup(app);
    expect(storage.objects.has(firstKey)).toBe(false);
    expect(storage.objects.has(secondKey)).toBe(true);
    await auth.agent
      .delete(`${ACCOUNT}/profile/avatar`)
      .set(auth.headers)
      .expect(200);
    await drainStorageCleanup(app);
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

  it.each([false, true])(
    'preserves the current avatar after corrupt processing and allows a retry (keyed=%s)',
    async (keyed) => {
      const auth = await authenticated();
      const assigned = await auth.agent
        .post(`${ACCOUNT}/profile/avatar`)
        .set(auth.headers)
        .attach('avatar', PNG, 'original.png')
        .expect(201);
      const oldKey = assigned.body.profile.media.avatar.storage_key as string;
      const audits = suite.dataSource.getRepository(AuditEventEntity);
      const baseline = await audits.count();
      const put = jest.spyOn(storage, 'putObject');
      const upload = (buffer: Buffer) => {
        const req = auth.agent
          .post(`${ACCOUNT}/profile/avatar`)
          .set(auth.headers);
        if (keyed) req.set('Idempotency-Key', 'processing-retry');
        return req.attach('avatar', buffer, 'replacement.png');
      };

      // Valid PNG signature, but no decodable image body.
      await upload(PNG.subarray(0, 8)).expect(400);

      const current = await suite.dataSource
        .getRepository(UserEntity)
        .findOneByOrFail({ id: auth.user.id });
      expect(current.profile.media.avatar?.storage_key).toBe(oldKey);
      expect(await audits.count()).toBe(baseline);
      expect(await suite.dataSource.getRepository(ImageEntity).count()).toBe(1);
      expect(storage.objects.size).toBe(1);
      expect(put).not.toHaveBeenCalled();
      expect(await readdir(env.UPLOAD_TMP_DIR)).toEqual([]);

      await upload(PNG).expect(201);
      expect(put).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['busy', 503],
    ['processing_failed', 400],
    ['limit_exceeded', 400],
  ] as const)(
    'preserves state on processor %s failure and retries the same key safely',
    async (code, status) => {
      const auth = await authenticated();
      const initial = await auth.agent
        .post(`${ACCOUNT}/profile/avatar`)
        .set(auth.headers)
        .attach('avatar', PNG, 'initial.png')
        .expect(201);
      const previousKey = initial.body.profile.media.avatar
        .storage_key as string;
      const images = suite.dataSource.getRepository(ImageEntity);
      const previous = await images.findOneByOrFail({
        storage_key: previousKey,
      });
      const audits = suite.dataSource.getRepository(AuditEventEntity);
      const baseline = await audits.count();
      const put = jest.spyOn(storage, 'putObject');
      const process = jest
        .spyOn(app.get(ImageProcessingService), 'process')
        .mockRejectedValueOnce(
          new ImageProcessingError(code, 'Image processing failed.'),
        );
      const upload = () =>
        auth.agent
          .post(`${ACCOUNT}/profile/avatar`)
          .set(auth.headers)
          .set('Idempotency-Key', 'processor-failure')
          .attach('avatar', PNG, 'replacement.png');

      await upload().expect(status);

      expect(await images.findOneByOrFail({ id: previous.id })).toEqual(
        previous,
      );
      expect(await audits.count()).toBe(baseline);
      expect(
        await suite.dataSource.getRepository(IdempotencyEntity).count(),
      ).toBe(0);
      expect(
        await suite.dataSource
          .getRepository(StorageDeletionIntentEntity)
          .count(),
      ).toBe(0);
      expect([...storage.objects.keys()]).toEqual([previousKey]);
      expect(put).not.toHaveBeenCalled();
      expect(await readdir(env.UPLOAD_TMP_DIR)).toEqual([]);

      const retried = await upload().expect(201);
      expect((await upload().expect(201)).body).toEqual(retried.body);
      expect(process).toHaveBeenCalledTimes(2);
      expect(put).toHaveBeenCalledTimes(1);
      expect(await audits.count()).toBe(baseline + 1);
      await drainStorageCleanup(app);
      expect([...storage.objects.keys()]).toEqual([
        retried.body.profile.media.avatar.storage_key,
      ]);
    },
  );

  it.each(['audit', 'cleanup intent'] as const)(
    'rolls back processed avatar replacement after %s failure and safely retries',
    async (failure) => {
      const auth = await authenticated();
      const initial = await auth.agent
        .post(`${ACCOUNT}/profile/avatar`)
        .set(auth.headers)
        .attach('avatar', PNG, 'initial.png')
        .expect(201);
      const previousKey = initial.body.profile.media.avatar
        .storage_key as string;
      const images = suite.dataSource.getRepository(ImageEntity);
      const previous = await images.findOneByOrFail({
        storage_key: previousKey,
      });
      const audits = suite.dataSource.getRepository(AuditEventEntity);
      const baseline = await audits.count();

      if (failure === 'audit') {
        jest
          .spyOn(app.get(AuditService), 'record')
          .mockRejectedValueOnce(new Error('private audit failure'));
      } else {
        jest
          .spyOn(app.get(StorageCleanupService), 'schedule')
          .mockRejectedValueOnce(new Error('private cleanup intent failure'));
      }

      const upload = () =>
        auth.agent
          .post(`${ACCOUNT}/profile/avatar`)
          .set(auth.headers)
          .set('Idempotency-Key', 'replacement-rollback')
          .attach('avatar', PNG, 'replacement.png');
      const failed = await upload().expect(500);

      expect(JSON.stringify(failed.body)).not.toContain('private');
      expect(await images.findOneByOrFail({ id: previous.id })).toEqual(
        previous,
      );
      const current = await suite.dataSource
        .getRepository(UserEntity)
        .findOneByOrFail({
          id: auth.user.id,
        });
      expect(current.profile.media.avatar?.storage_key).toBe(previousKey);
      expect(await images.count()).toBe(1);
      expect(await audits.count()).toBe(baseline);
      expect(
        await suite.dataSource.getRepository(IdempotencyEntity).count(),
      ).toBe(0);
      expect(
        await suite.dataSource
          .getRepository(StorageDeletionIntentEntity)
          .count(),
      ).toBe(0);
      expect(await readdir(env.UPLOAD_TMP_DIR)).toEqual([]);
      await drainStorageCleanup(app);
      expect([...storage.objects.keys()]).toEqual([previousKey]);

      const retried = await upload().expect(201);
      expect((await upload().expect(201)).body).toEqual(retried.body);
      expect(await audits.count()).toBe(baseline + 1);
      await drainStorageCleanup(app);
      expect([...storage.objects.keys()]).toEqual([
        retried.body.profile.media.avatar.storage_key,
      ]);
    },
  );

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
    expect(remove).not.toHaveBeenCalled();
    await drainStorageCleanup(app);
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
    await drainStorageCleanup(app);
    expect(storage.objects.size).toBe(1);
    expect(put).toHaveBeenCalledTimes(3);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(await audits.count()).toBe(baseline + 4);
    for (const key of ['assign', 'replace', 'remove', 'new-avatar'])
      expect(await audits.countBy({ idempotency_key: key })).toBe(1);
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
    expect(storage.objects.size).toBe(1);
    await drainStorageCleanup(app);
    expect(storage.objects.size).toBe(0);
    expect(await suite.dataSource.getRepository(ImageEntity).count()).toBe(0);
    expect(
      await suite.dataSource.getRepository(IdempotencyEntity).count(),
    ).toBe(0);
    expect(await readdir(env.UPLOAD_TMP_DIR)).toEqual([]);
    await upload().expect(201);
    expect(storage.objects.size).toBe(1);
  });

  it('recovers an uncertain failed PUT while retrying the same HTTP key with a new object key', async () => {
    const auth = await authenticated();
    const upload = () =>
      auth.agent
        .post(`${ACCOUNT}/profile/avatar`)
        .set(auth.headers)
        .set('Idempotency-Key', 'uncertain-put')
        .attach('avatar', PNG, 'avatar.png');
    const put = storage.putObject.bind(storage);
    jest.spyOn(storage, 'putObject').mockImplementationOnce(async (input) => {
      await put(input);
      throw new Error('secret provider response after acceptance');
    });
    const failed = await upload().expect(503);
    expect(JSON.stringify(failed.body)).not.toContain('secret provider');
    const orphan = await suite.dataSource
      .getRepository(StorageObjectEntity)
      .findOneByOrFail({ state: 'reserved' });
    expect(storage.objects.has(orphan.storage_key)).toBe(true);
    expect(await suite.dataSource.getRepository(ImageEntity).count()).toBe(0);
    expect(
      await suite.dataSource.getRepository(IdempotencyEntity).count(),
    ).toBe(0);
    expect(await readdir(env.UPLOAD_TMP_DIR)).toEqual([]);
    const retried = await upload().expect(201);
    const current = retried.body.profile.media.avatar.storage_key as string;
    expect(current).not.toBe(orphan.storage_key);
    const replayed = await upload().expect(201);
    expect(replayed.body).toEqual(retried.body);
    expect(storage.putObject).toHaveBeenCalledTimes(2);
    await suite.dataSource.manager.update(
      StorageObjectEntity,
      { storage_key: orphan.storage_key },
      { expires_at: new Date(0) },
    );
    await drainStorageCleanup(app);
    expect([...storage.objects.keys()]).toEqual([current]);
    expect(await suite.dataSource.getRepository(ImageEntity).count()).toBe(1);
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
    await upload('cleanup-replacement').expect(201);
    expect(remove).not.toHaveBeenCalled();
    const intent = await suite.dataSource
      .getRepository(StorageDeletionIntentEntity)
      .findOneByOrFail({ storage_key: oldKey });
    for (let attempt = 0; attempt < STORAGE_CLEANUP_ATTEMPTS; attempt++)
      await expect(
        app.get(StorageCleanupService).deleteObject(intent.id),
      ).rejects.toThrow();
    const persisted = await suite.dataSource
      .getRepository(UserEntity)
      .findOneByOrFail({ id: auth.user.id });
    const newKey = persisted.profile.media.avatar!.storage_key;
    expect(newKey).not.toBe(oldKey);
    expect(storage.objects.has(newKey)).toBe(true);
    expect(storage.objects.has(oldKey)).toBe(true);
    expect(await suite.dataSource.getRepository(ImageEntity).count()).toBe(1);
    expect(await audits.count()).toBe(baseline + 1);
    expect(remove).toHaveBeenCalledTimes(STORAGE_CLEANUP_ATTEMPTS);
    const replay = await upload('cleanup-replacement').expect(201);
    expect(replay.body.profile.media.avatar.storage_key).toBe(newKey);
    expect(put).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(STORAGE_CLEANUP_ATTEMPTS);
    expect(await audits.count()).toBe(baseline + 1);
    expect(await readdir(env.UPLOAD_TMP_DIR)).toEqual([]);
  });

  it('retries deleted-account avatar cleanup without touching a replacement account using the same email', async () => {
    const original = await authenticated();
    const uploaded = await original.agent
      .post(`${ACCOUNT}/profile/avatar`)
      .set(original.headers)
      .attach('avatar', PNG, 'original.png')
      .expect(201);
    const oldAvatar = uploaded.body.profile.media.avatar;
    const originalImage = await suite.dataSource
      .getRepository(ImageEntity)
      .findOneByOrFail({ storage_key: oldAvatar.storage_key });
    await original.agent
      .post(`${ACCOUNT}/delete`)
      .set(original.headers)
      .send({ password: 'Valid!Pass1' })
      .expect(204);
    const tombstone = await suite.dataSource
      .getRepository(UserEntity)
      .findOneByOrFail({ id: original.user.id });
    expect(tombstone.status.key).toBe('deleted');
    expect(tombstone.identity.email).toMatch(
      /^deleted-[0-9a-f-]+@users\.invalid$/,
    );
    expect(tombstone.profile.media.avatar).toBeNull();
    expect(tombstone.profile.personal).toEqual(original.user.profile.personal);
    const events = await suite.dataSource
      .getRepository(AuditEventEntity)
      .findBy({
        event: 'identity.account.deleted',
        subject_id: original.user.id,
      });
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event).toMatchObject({
      actor_id: original.user.id,
      subject_id: original.user.id,
      resource_id: original.user.id,
      before: {
        id: original.user.id,
        status: { key: 'active' },
        identity: { email: '[CHANGED]' },
        profile: { media: { avatar_id: originalImage.id } },
        metadata: { deleted_at: null },
      },
      after: {
        id: original.user.id,
        status: { key: 'deleted' },
        identity: { email: '[CHANGED]' },
        profile: { media: { avatar_id: null } },
        metadata: { deleted_at: tombstone.metadata.deleted_at!.toISOString() },
      },
      changes: {
        status: { key: { before: 'active', after: 'deleted' } },
        profile: {
          media: { avatar_id: { before: originalImage.id, after: null } },
        },
        metadata: {
          deleted_at: {
            before: null,
            after: tombstone.metadata.deleted_at!.toISOString(),
          },
        },
        identity: { email: { before: '[CHANGED]', after: '[CHANGED]' } },
      },
    });
    expect(JSON.stringify(event)).not.toContain(original.user.identity.email);
    expect(
      await suite.dataSource
        .getRepository(ImageEntity)
        .findOneBy({ storage_key: oldAvatar.storage_key }),
    ).toBeNull();
    const deletion = jest
      .spyOn(storage, 'deleteObject')
      .mockRejectedValueOnce(new Error('provider unavailable'));
    await expect(drainStorageCleanup(app)).rejects.toThrow();
    expect(storage.objects.has(oldAvatar.storage_key)).toBe(true);
    const intent = await suite.dataSource
      .getRepository(StorageDeletionIntentEntity)
      .findOneByOrFail({ storage_key: oldAvatar.storage_key });
    expect(intent).toMatchObject({ state: 'pending', attempts: 1 });

    const replacement = await authenticated();
    expect(replacement.user.id).not.toBe(original.user.id);
    expect(replacement.user.identity.email).toBe(original.user.identity.email);
    const newest = await replacement.agent
      .post(`${ACCOUNT}/profile/avatar`)
      .set(replacement.headers)
      .attach('avatar', PNG, 'replacement.png')
      .expect(201);
    const newAvatar = newest.body.profile.media.avatar;
    await drainStorageCleanup(app);
    expect(deletion).toHaveBeenCalledTimes(2);
    expect(storage.objects.has(oldAvatar.storage_key)).toBe(false);
    expect(storage.objects.has(newAvatar.storage_key)).toBe(true);
    const current = await suite.dataSource
      .getRepository(UserEntity)
      .findOneByOrFail({ id: replacement.user.id });
    expect(current.status.key).toBe('active');
    expect(current.metadata.deleted_at).toBeNull();
    expect(current.profile.media.avatar?.storage_key).toBe(
      newAvatar.storage_key,
    );
  });

  it('rolls back self-deletion and its avatar/email changes if the success audit fails', async () => {
    const auth = await authenticated();
    const uploaded = await auth.agent
      .post(`${ACCOUNT}/profile/avatar`)
      .set(auth.headers)
      .attach('avatar', PNG, 'audit-rollback.png')
      .expect(201);
    const key = uploaded.body.profile.media.avatar.storage_key as string;
    const audit = jest
      .spyOn(app.get(AuditService), 'record')
      .mockRejectedValueOnce(new Error('audit unavailable'));
    const remove = () =>
      auth.agent
        .post(`${ACCOUNT}/delete`)
        .set(auth.headers)
        .send({ password: 'Valid!Pass1' });
    await remove().expect(500);
    audit.mockRestore();
    const current = await suite.dataSource
      .getRepository(UserEntity)
      .findOneByOrFail({ id: auth.user.id });
    expect(current.status.key).toBe('active');
    expect(current.metadata.deleted_at).toBeNull();
    expect(current.identity.email).toBe(auth.user.identity.email);
    expect(current.identity.password).toBeTruthy();
    expect(current.profile.media.avatar?.storage_key).toBe(key);
    expect(storage.objects.has(key)).toBe(true);
    expect(
      await suite.dataSource.getRepository(StorageDeletionIntentEntity).count(),
    ).toBe(0);
    const events = suite.dataSource.getRepository(AuditEventEntity);
    const where = {
      event: 'identity.account.deleted',
      subject_id: auth.user.id,
    };
    expect(await events.countBy(where)).toBe(0);
    await remove().expect(204);
    expect(await events.countBy(where)).toBe(1);
    await remove().expect(404);
    expect(await events.countBy(where)).toBe(1);
  });

  it('requires authentication and soft deletes the current account while preserving historical data', async () => {
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
    ).toMatchObject({
      metadata: { deleted_at: expect.any(Date) },
      identity: { password: null },
      profile: {
        name: auth.user.profile.name,
        personal: auth.user.profile.personal,
        region: auth.user.profile.region,
        media: { avatar: null },
      },
      status: { key: 'deleted' },
      roles: [],
    });
    await auth.agent.get(`${ACCOUNT}/profile`).set(auth.headers).expect(404);
  });
});
