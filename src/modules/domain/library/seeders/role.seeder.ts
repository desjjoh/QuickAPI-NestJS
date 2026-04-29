import { SystemPermissions } from '@/config/permissions.config';
import { PermissionEntity } from '../entities/permission.entity';
import { RoleEntity } from '../entities/role.entity';
import { DataSource, In, Repository } from 'typeorm';
import {
  Seeder,
  SeederResult,
} from '@/modules/system/seeder/types/seeder.types';

export type RoleSeed = {
  key: string;
  label: string;
  description: string;
  permissions: string[];
};

export const ROLES_SEED: RoleSeed[] = [
  {
    key: 'system-administrator',
    label: 'System Administrator',
    description:
      'Full system access. Bypasses all permission checks through override capability.',
    permissions: [SystemPermissions.HAS_ALL_PERMISSIONS],
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
