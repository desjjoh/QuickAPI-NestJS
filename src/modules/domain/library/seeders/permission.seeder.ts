import {
  AccountManagementPermissions,
  ArticleAdministrationPermissions,
  ArticleCreatorPermissions,
  AuditPermissions,
  SystemPermissions,
  UserAdministrationPermissions,
} from '@/config/permissions.config';
import { PermissionEntity } from '../entities/permission.entity';
import {
  Seeder,
  SeederResult,
} from '@/modules/system/seeder/types/seeder.types';
import { EntityManager, Repository } from 'typeorm';

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

  // ARTICLE CREATION
  {
    key: String(ArticleCreatorPermissions.CREATE_ARTICLES),
    label: 'Create articles',
    description: 'Allows a creator to create articles under their own account.',
  },
  {
    key: String(ArticleCreatorPermissions.READ_OWN_ARTICLES),
    label: 'Read own articles',
    description:
      'Allows a creator to view articles authored by their own account.',
  },
  {
    key: String(ArticleCreatorPermissions.UPDATE_OWN_ARTICLES),
    label: 'Update own articles',
    description:
      'Allows a creator to update eligible articles authored by their own account.',
  },
  {
    key: String(ArticleCreatorPermissions.SUBMIT_OWN_ARTICLES),
    label: 'Submit own articles',
    description:
      'Allows a creator to submit their own draft articles for review.',
  },
  {
    key: String(ArticleCreatorPermissions.WITHDRAW_OWN_ARTICLES),
    label: 'Withdraw own articles',
    description:
      'Allows a creator to return their own submitted articles to draft.',
  },

  // ARTICLE ADMINISTRATION
  {
    key: String(ArticleAdministrationPermissions.READ_ARTICLES),
    label: 'Read articles for administration',
    description:
      'Allows an administrator to view articles in every lifecycle status.',
  },
  {
    key: String(ArticleAdministrationPermissions.PUBLISH_ARTICLES),
    label: 'Publish articles',
    description: 'Allows an administrator to publish submitted articles.',
  },
  {
    key: String(ArticleAdministrationPermissions.RETURN_ARTICLES_TO_DRAFT),
    label: 'Return articles to draft',
    description:
      'Allows an administrator to return submitted articles to draft for revision.',
  },
  {
    key: String(ArticleAdministrationPermissions.ARCHIVE_ARTICLES),
    label: 'Archive articles',
    description: 'Allows an administrator to archive published articles.',
  },
  {
    key: String(ArticleAdministrationPermissions.RESTORE_ARTICLES),
    label: 'Restore articles',
    description:
      'Allows an administrator to restore archived articles to draft.',
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

  public async run(manager: EntityManager): Promise<SeederResult> {
    const repository: Repository<PermissionEntity> =
      manager.getRepository(PermissionEntity);

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
