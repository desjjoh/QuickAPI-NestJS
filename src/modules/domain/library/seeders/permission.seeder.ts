import {
  AccountManagementPermissions,
  SystemPermissions,
  UserManagementPermissions,
} from '@/config/permissions.config';
import { PermissionEntity } from '../entities/permission.entity';
import {
  Seeder,
  SeederResult,
} from '@/modules/system/seeder/types/seeder.types';
import { DataSource, Repository } from 'typeorm';

export type PermissionSeed = {
  key: string;
  label: string;
  description: string;
};

export const PERMISSIONS_SEED: PermissionSeed[] = [
  // SYSTEM LEVEL PERMISSIONS
  {
    key: String(SystemPermissions.HAS_ALL_PERMISSIONS),
    label: 'Has All Permissions',
    description:
      'Grants unrestricted access to all actions across the system, bypassing normal checks.',
  },

  // ACCOUNT MANAGEMENT
  {
    key: String(AccountManagementPermissions.READ_ACCOUNT),
    label: 'Read account',
    description:
      'Allows the user to view their own profile and account details.',
  },
  {
    key: String(AccountManagementPermissions.UPDATE_ACCOUNT),
    label: 'Update account',
    description:
      'Allows the user to update their own profile and account details.',
  },
  {
    key: String(AccountManagementPermissions.DELETE_ACCOUNT),
    label: 'Delete account',
    description: 'Allows the user to delete or deactivate their own account.',
  },

  // USER ADMINISTRATION
  {
    key: String(UserManagementPermissions.CREATE_USERS),
    label: 'Create users',
    description: 'Allows the creation of new user accounts.',
  },
  {
    key: String(UserManagementPermissions.READ_USERS),
    label: 'Read users',
    description: 'Allows viewing of user details and lists.',
  },
  {
    key: String(UserManagementPermissions.UPDATE_USERS),
    label: 'Update users',
    description: 'Allows editing user information and attributes.',
  },
  {
    key: String(UserManagementPermissions.DELETE_USERS),
    label: 'Delete users',
    description: 'Allows removal or deactivation of user accounts.',
  },
];

export class PermissionSeeder implements Seeder {
  public readonly name: string = PermissionSeeder.name;
  public readonly order: number = 30;

  public async run(dataSource: DataSource): Promise<SeederResult> {
    const repository: Repository<PermissionEntity> =
      dataSource.getRepository(PermissionEntity);

    let created = 0;
    let skipped = 0;

    for (const seed of PERMISSIONS_SEED) {
      const existingPermission: PermissionEntity | null =
        await repository.findOne({
          where: { key: seed.key },
        });

      if (existingPermission) {
        skipped += 1;
        continue;
      }

      const permission: PermissionEntity = repository.create({
        key: seed.key,
        label: seed.label,
        description: seed.description,
      });

      await repository.save(permission);

      created += 1;
    }

    return { created, skipped };
  }
}
