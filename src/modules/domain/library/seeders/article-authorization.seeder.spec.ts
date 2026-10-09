import {
  ArticleAdministrationPermissions,
  ArticleCreatorPermissions,
  PERMISSION_MATRIX,
  PermissionDomain,
} from '@/config/permissions.config';

import { PermissionEntity } from '../entities/permission.entity';
import { RoleEntity } from '../entities/role.entity';
import { PERMISSIONS_SEED } from './permission.seeder';
import { ROLE_KEYS, ROLES_SEED, RoleSeeder } from './role.seeder';

describe('article authorization seeds', () => {
  const creatorPermissions = Object.values(ArticleCreatorPermissions);
  const administrationPermissions = Object.values(
    ArticleAdministrationPermissions,
  );

  it('registers every article permission in the permission matrix and seeds', () => {
    expect(PERMISSION_MATRIX[PermissionDomain.ARTICLE_CREATOR]).toBe(
      ArticleCreatorPermissions,
    );
    expect(PERMISSION_MATRIX[PermissionDomain.ARTICLE_ADMINISTRATION]).toBe(
      ArticleAdministrationPermissions,
    );

    const seededKeys = new Set(PERMISSIONS_SEED.map(({ key }) => key));

    expect(creatorPermissions.every((key) => seededKeys.has(key))).toBe(true);
    expect(administrationPermissions.every((key) => seededKeys.has(key))).toBe(
      true,
    );
  });

  it('assigns creator permissions only to the supplemental creator role', () => {
    const creator = ROLES_SEED.find(({ key }) => key === ROLE_KEYS.CREATOR);

    expect(creator?.permissions).toEqual(creatorPermissions);
    expect(creator?.permissions).not.toEqual(
      expect.arrayContaining(administrationPermissions),
    );
  });

  it('assigns article administration permissions to the administrator role', () => {
    const administrator = ROLES_SEED.find(
      ({ key }) => key === ROLE_KEYS.ADMINISTRATOR,
    );

    expect(administrator?.permissions).toEqual(
      expect.arrayContaining(administrationPermissions),
    );
    expect(administrator?.permissions).not.toEqual(
      expect.arrayContaining(creatorPermissions),
    );
  });

  it('adds newly seeded permissions to existing roles without removing assignments', async () => {
    const customPermission = { id: 'custom', key: 'custom_permission' };
    const existingRoles = new Map(
      ROLES_SEED.map((seed) => [
        seed.key,
        {
          id: `role-${seed.key}`,
          key: seed.key,
          permissions:
            seed.key === ROLE_KEYS.ADMINISTRATOR
              ? [customPermission]
              : seed.permissions.map((key) => ({ id: key, key })),
        },
      ]),
    );
    const roleRepository = {
      findOne: jest.fn(({ where: { key } }) => existingRoles.get(key)),
      create: jest.fn((input) => input),
      save: jest.fn((input) => input),
    };
    const permissionRepository = {
      find: jest
        .fn()
        .mockImplementationOnce(() =>
          ROLES_SEED[0].permissions.map((key) => ({ id: key, key })),
        )
        .mockImplementationOnce(() =>
          ROLES_SEED[1].permissions.map((key) => ({ id: key, key })),
        )
        .mockImplementationOnce(() =>
          ROLES_SEED[2].permissions.map((key) => ({ id: key, key })),
        )
        .mockImplementationOnce(() =>
          ROLES_SEED[3].permissions.map((key) => ({ id: key, key })),
        ),
    };
    const manager = {
      getRepository: jest.fn((entity) =>
        entity === RoleEntity ? roleRepository : permissionRepository,
      ),
    };

    await expect(new RoleSeeder().run(manager as never)).resolves.toEqual({
      created: 0,
      skipped: ROLES_SEED.length,
    });

    expect(roleRepository.save).toHaveBeenCalledTimes(1);
    expect(roleRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        key: ROLE_KEYS.ADMINISTRATOR,
        permissions: expect.arrayContaining([
          customPermission,
          ...administrationPermissions.map((key) =>
            expect.objectContaining({ key }),
          ),
        ]),
      }),
    );
    expect(manager.getRepository).toHaveBeenCalledWith(PermissionEntity);
  });
});
