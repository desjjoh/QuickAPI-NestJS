import { BadRequestException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { EntityManager, type DataSource } from 'typeorm';
import { TransactionLifecycle } from '@/common/helpers/transaction.helper';

import { ImageEntity } from '@/modules/domain/media/entities/image.entity';
import type { ImageService } from '@/modules/domain/media/services/image.service';
import { UserPhoneEntity } from '@/modules/domain/identity/entities/phone.entity';
import { UserProfileEntity } from '@/modules/domain/identity/entities/profile.entity';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import {
  createUserMetadata,
  UserEntity,
} from '@/modules/domain/identity/entities/user.entity';
import { UserRepository } from '@/modules/domain/identity/repositories/user.repository';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { IdentityReferenceService } from '@/modules/domain/identity/services/identity-reference.service';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';
import { UserAdministrationService } from '@/modules/domain/identity/services/user-administration.service';
import { UserLifecycleService } from '@/modules/domain/identity/services/user-lifecycle.service';
import { UserProfileService } from '@/modules/domain/identity/services/user-profile.service';
import { SessionRepository } from '@/modules/domain/identity/repositories/session.repository';
import { AccountStatusEntity } from '@/modules/domain/library/entities/accountstatus.entity';
import { AccountStatusRepository } from '@/modules/domain/library/repositories/accountstatus.repository';
import { CountryEntity } from '@/modules/domain/library/entities/country.entity';
import { GenderEntity } from '@/modules/domain/library/entities/gender.entity';
import { RoleEntity } from '@/modules/domain/library/entities/role.entity';
import { RoleRepository } from '@/modules/domain/library/repositories/role.repository';
import { TimezoneEntity } from '@/modules/domain/library/entities/time-zone.entity';
import {
  closeTestDataSource,
  initializeTestDataSource,
  resetMutableTables,
} from '../../helpers/database/test-database';

describe('UserRepository (disposable MySQL)', () => {
  let dataSource: DataSource;
  let repository: UserRepository;
  let userService: UserService;
  let lifecycle: UserLifecycleService;
  let userProfile: UserProfileService;
  let administration: UserAdministrationService;
  let refresh: RefreshService;
  let imageService: {
    remove: jest.Mock<ImageService['remove']>;
  };
  let sequence = 0;

  beforeAll(async () => {
    dataSource = await initializeTestDataSource();
  });

  beforeEach(async () => {
    await resetMutableTables(dataSource);
    imageService = { remove: jest.fn(async (image) => image) };
    repository = new UserRepository(dataSource);
    userService = new UserService(repository);
    const references = new IdentityReferenceService(
      new RoleRepository(dataSource),
      new AccountStatusRepository(dataSource),
    );
    lifecycle = new UserLifecycleService(
      userService,
      repository,
      references,
      imageService as unknown as ImageService,
    );
    userProfile = new UserProfileService(repository);
    refresh = new RefreshService(
      {} as never,
      new SessionRepository(dataSource),
      {} as never,
      {} as never,
    );
    administration = new UserAdministrationService(
      userService,
      repository,
      references,
      refresh,
    );
  });

  afterAll(async () => {
    if (dataSource) await closeTestDataSource(dataSource);
  });

  async function referenceData() {
    const [status, gender, country, timezone, role] = await Promise.all([
      dataSource
        .getRepository(AccountStatusEntity)
        .findOneByOrFail({ key: 'active' }),
      dataSource
        .getRepository(GenderEntity)
        .findOneByOrFail({ key: 'prefer_not_to_say' }),
      dataSource
        .getRepository(CountryEntity)
        .findOneByOrFail({ key: 'canada' }),
      dataSource.getRepository(TimezoneEntity).findOneByOrFail({ key: 'UTC' }),
      dataSource.getRepository(RoleEntity).findOneByOrFail({ key: 'user' }),
    ]);
    return { status, gender, country, timezone, role };
  }

  async function createUser(
    avatar: ImageEntity | null = null,
  ): Promise<UserEntity> {
    const refs = await referenceData();
    sequence += 1;
    return lifecycle.createUser({
      identity: {
        email: `repository-${sequence}@example.test`,
        password: 'hash',
      },
      profile: {
        name: { first: 'Repository', last: 'Test', preferred: null },
        personal: {
          bio: null,
          dob: '1990-01-01',
          gender: { id: refs.gender.id },
        },
        region: {
          country: { id: refs.country.id },
          timezone: { id: refs.timezone.id },
        },
        media: { avatar },
      },
      metadata: createUserMetadata(),
      status: { id: refs.status.id },
      roles: [{ id: refs.role.id }],
    });
  }

  async function createImage(storageKey: string): Promise<ImageEntity> {
    const images = dataSource.getRepository(ImageEntity);
    return images.save(
      images.create({
        storage_key: storageKey,
        filename: storageKey.split('/').at(-1) ?? 'avatar.png',
        mime_type: 'image/png',
        size_bytes: 10,
        width: 1,
        height: 1,
        alt_text: null,
      }),
    );
  }

  it('increments only active sessions', async () => {
    const user = await createUser();
    const sessions = dataSource.getRepository(UserSessionEntity);
    const active = await sessions.save(
      sessions.create({
        user,
        active: true,
        refresh: 'active',
        token_version: 2,
      }),
    );
    const inactive = await sessions.save(
      sessions.create({
        user,
        active: false,
        refresh: 'inactive',
        token_version: 7,
      }),
    );

    await refresh.incrementTokenVersion(user.id);
    expect(await sessions.findOneByOrFail({ id: active.id })).toMatchObject({
      token_version: 3,
      active: true,
    });
    expect(await sessions.findOneByOrFail({ id: inactive.id })).toMatchObject({
      token_version: 7,
      active: false,
    });
  });

  it('finds persisted identities by email, phone, and id and rejects an unknown id', async () => {
    const user = await createUser();
    const { country } = await referenceData();
    const phones = dataSource.getRepository(UserPhoneEntity);
    await phones.save(
      phones.create({
        profile: user.profile,
        country,
        phone_calling_code: '1',
        phone_national_number: '6135550199',
        phone_e164: '+16135550199',
      }),
    );

    await expect(
      repository.findByEmail(dataSource.manager, user.identity.email),
    ).resolves.toMatchObject({ id: user.id });
    await expect(
      repository.findByEmail(dataSource.manager, 'missing@example.test'),
    ).resolves.toBeNull();
    await expect(
      repository.findByPhone(dataSource.manager, '+16135550199'),
    ).resolves.toMatchObject({ id: user.id });
    await expect(
      repository.findByPhone(dataSource.manager, '+19999999999'),
    ).resolves.toBeNull();
    await expect(userService.findByIdOrFail(user.id)).resolves.toMatchObject({
      id: user.id,
    });
    await expect(
      userService.findByIdOrFail('missing-user'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a user with its persisted profile and eager relations', async () => {
    const user = await createUser();
    const persisted = await dataSource
      .getRepository(UserEntity)
      .findOneByOrFail({ id: user.id });

    expect(persisted).toMatchObject({
      identity: { email: user.identity.email },
      profile: { name: { first: 'Repository', last: 'Test' } },
      status: { key: 'active' },
      roles: [expect.objectContaining({ key: 'user' })],
    });
  });

  it('clears a persisted profile avatar without deleting the image', async () => {
    const image = await createImage('avatars/test.png');
    const user = await createUser(image);

    await userProfile.clearAvatar(user.profile.id);

    const profile = await dataSource
      .getRepository(UserProfileEntity)
      .findOneByOrFail({ id: user.profile.id });
    expect(profile.media.avatar).toBeNull();
    await expect(
      dataSource.getRepository(ImageEntity).findOneBy({ id: image.id }),
    ).resolves.not.toBeNull();
  });

  it.each([false, true])(
    'transactionally removes user/profile and removes storage only with an avatar (%s)',
    async (withAvatar) => {
      const image = withAvatar ? await createImage('avatars/delete.png') : null;
      const user = await createUser(image);
      const userId = user.id;
      const profileId = user.profile.id;

      imageService.remove.mockImplementation(
        async (avatar, manager, transactionLifecycle) => {
          // Assert primitives to avoid Jest diffing TypeORM's circular object graph.
          expect(manager instanceof EntityManager).toBe(true);
          expect(manager === dataSource.manager).toBe(false);
          expect(manager?.queryRunner?.isTransactionActive).toBe(true);
          expect(transactionLifecycle instanceof TransactionLifecycle).toBe(
            true,
          );
          return avatar;
        },
      );

      await lifecycle.deleteUser(user);

      await expect(
        dataSource.getRepository(UserEntity).findOneBy({ id: userId }),
      ).resolves.toBeNull();
      await expect(
        dataSource
          .getRepository(UserProfileEntity)
          .findOneBy({ id: profileId }),
      ).resolves.toBeNull();
      expect(imageService.remove).toHaveBeenCalledTimes(withAvatar ? 1 : 0);
      if (image) {
        const call = imageService.remove.mock.calls[0];
        expect(call.length).toBe(3);
        expect(call[0].id).toBe(image.id);
        expect(call[1]?.queryRunner?.isReleased).toBe(true);
      }
    },
  );

  describe('administrative updates', () => {
    it('replaces a valid status', async () => {
      const user = await createUser();
      const disabled = await dataSource
        .getRepository(AccountStatusEntity)
        .findOneByOrFail({ key: 'disabled' });
      await expect(
        administration.updateAdministration(user, {
          status_id: disabled.id,
        }),
      ).resolves.toMatchObject({ status: { key: 'disabled' } });
    });

    it('rejects an unknown status without changing existing data', async () => {
      const user = await createUser();
      await expect(
        administration.updateAdministration(user, {
          status_id: 'unknown-status',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(userService.findByIdOrFail(user.id)).resolves.toMatchObject({
        status: { key: 'active' },
        roles: [expect.objectContaining({ key: 'user' })],
      });
    });

    it('replaces roles with valid persisted roles', async () => {
      const user = await createUser();
      const administrator = await dataSource
        .getRepository(RoleEntity)
        .findOneByOrFail({ key: 'system-administrator' });
      const updated = await administration.updateAdministration(user, {
        role_ids: [administrator.id],
      });
      expect(updated.roles?.map(({ key }) => key)).toEqual([
        'system-administrator',
      ]);
    });

    it('rejects one or more unknown roles and preserves status and roles', async () => {
      const user = await createUser();
      const disabled = await dataSource
        .getRepository(AccountStatusEntity)
        .findOneByOrFail({ key: 'disabled' });
      const administrator = await dataSource
        .getRepository(RoleEntity)
        .findOneByOrFail({ key: 'system-administrator' });
      await expect(
        administration.updateAdministration(user, {
          status_id: disabled.id,
          role_ids: [administrator.id, 'unknown-role'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      const unchanged = await userService.findByIdOrFail(user.id);
      expect(unchanged.status.key).toBe('active');
      expect(unchanged.roles?.map(({ key }) => key)).toEqual(['user']);
    });

    it('supports removing every role with an empty replacement', async () => {
      const user = await createUser();
      const updated = await administration.updateAdministration(user, {
        role_ids: [],
      });
      expect(updated.roles).toEqual([]);
    });
  });
});
