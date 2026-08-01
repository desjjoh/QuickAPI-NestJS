import {
  AccountManagementPermissions,
  AuditPermissions,
  SystemPermissions,
  UserAdministrationPermissions,
} from '@/config/permissions.config';
import { PermissionEntity } from '../entities/permission.entity';
import { RoleEntity } from '../entities/role.entity';
import { DataSource, In, Repository } from 'typeorm';
import {
  Seeder,
  SeederResult,
} from '@/modules/system/seeder/types/seeder.types';

export enum ROLE_KEYS {
  USER = 'user',
  ADMINISTRATOR = 'administrator',
  SYSTEM_ADMINISTRATOR = 'system-administrator',
}

export type RoleSeed = {
  key: ROLE_KEYS;
  label: string;
  description: string;
  permissions: string[];
};

export const ROLES_SEED: RoleSeed[] = [
  {
    key: ROLE_KEYS.SYSTEM_ADMINISTRATOR,
    label: 'System Administrator',
    description:
      'Full system access. Bypasses all permission checks through override capability.',
    permissions: [SystemPermissions.HAS_ALL_PERMISSIONS],
  },
  {
    key: ROLE_KEYS.ADMINISTRATOR,
    label: 'Administrator',
    description:
      'Administrative access to manage users and inspect retained user activity.',
    permissions: [
      ...Object.values(UserAdministrationPermissions),
      AuditPermissions.SEARCH_AUDIT,
      AuditPermissions.READ_AUDIT_DETAIL,
    ],
  },
  {
    key: ROLE_KEYS.USER,
    label: 'User',
    description: 'Default role assigned to active user accounts.',
    permissions: [
      AccountManagementPermissions.UPDATE_ACCOUNT,
      AccountManagementPermissions.DELETE_ACCOUNT,
      AccountManagementPermissions.READ_CURRENT_USER_ACTIVITY,
    ],
  },
];

export class RoleSeeder implements Seeder {
  public readonly name: string = RoleSeeder.name;
  public readonly order: number = 40;

  public async run(dataSource: DataSource): Promise<SeederResult> {
    const roleRepository: Repository<RoleEntity> =
      dataSource.getRepository(RoleEntity);

    const permissionRepository: Repository<PermissionEntity> =
      dataSource.getRepository(PermissionEntity);

    let created = 0;
    let skipped = 0;

    for (const seed of ROLES_SEED) {
      const existingRole: RoleEntity | null = await roleRepository.findOne({
        where: { key: seed.key },
      });

      if (existingRole) {
        skipped += 1;
        continue;
      }

      const permissions: PermissionEntity[] = await permissionRepository.find({
        where: {
          key: In([...seed.permissions]),
        },
      });

      this.assertAllPermissionsExist(seed.key, seed.permissions, permissions);

      const role: RoleEntity = roleRepository.create({
        key: seed.key,
        label: seed.label,
        description: seed.description ?? null,
        permissions,
      });

      await roleRepository.save(role);

      created += 1;
    }

    return { created, skipped };
  }

  private assertAllPermissionsExist(
    roleKey: string,
    expectedPermissionKeys: readonly string[],
    permissions: PermissionEntity[],
  ): void {
    const foundPermissionKeys = new Set(
      permissions.map((permission: PermissionEntity) => permission.key),
    );

    const missingPermissionKeys = expectedPermissionKeys.filter(
      (key: string) => !foundPermissionKeys.has(key),
    );

    if (missingPermissionKeys.length === 0) return;

    throw new Error(
      `Role seed "${roleKey}" references missing permissions: ${missingPermissionKeys.join(
        ', ',
      )}`,
    );
  }
}
