import {
  AccountManagementPermissions,
  AuditPermissions,
  SystemPermissions,
  UserAdministrationPermissions,
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
  {
    key: String(AccountManagementPermissions.READ_CURRENT_USER_ACTIVITY),
    label: 'Read current-user activity',
    description: 'Allows a user to view only their own retained activity.',
  },

  // USER ADMINISTRATION
  {
    key: String(UserAdministrationPermissions.CREATE_USERS),
    label: 'Create users',
    description: 'Allows the creation of new user accounts.',
  },
  {
    key: String(UserAdministrationPermissions.READ_USERS),
    label: 'Read users',
    description: 'Allows viewing of user details and lists.',
  },
  {
    key: String(UserAdministrationPermissions.UPDATE_USERS),
    label: 'Update users',
    description: 'Allows editing user information and attributes.',
  },
  {
    key: String(UserAdministrationPermissions.DELETE_USERS),
    label: 'Delete users',
    description: 'Allows removal or deactivation of user accounts.',
  },
  {
    key: String(
      UserAdministrationPermissions.READ_ADMINISTRATION_USER_ACTIVITY,
    ),
    label: 'Read administration user activity',
    description:
      'Allows viewing retained audit and security activity for user accounts.',
  },

  // AUDIT ADMINISTRATION
  {
    key: String(AuditPermissions.SEARCH_AUDIT),
    label: 'Search audit records',
    description: 'Allows generic searches across retained audit records.',
  },
  {
    key: String(AuditPermissions.READ_AUDIT_DETAIL),
    label: 'Read audit detail',
    description: 'Allows viewing an individual approved audit response.',
  },
  {
    key: String(AuditPermissions.EXPORT_AUDIT),
    label: 'Export audit records',
    description: 'Reserved for a separately authorized future audit export.',
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
