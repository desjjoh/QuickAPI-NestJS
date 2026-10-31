import { isUserDeleted } from '../policies/user-deletion.policy';
import {
  applicationManager,
  runInTransaction,
} from '@/common/helpers/transaction.helper';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';

import {
  ACCOUNT_STATUS_KEYS,
  AccountStatusKey,
} from '@/config/statuses.config';
import { ROLE_KEYS } from '@/modules/domain/identity/seeders/role.seeder';

import { UserEntity } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { IdentityReferenceService } from './identity-reference.service';
import { RefreshService } from './refresh.service';
import { UserService } from './user.service';
import { assertUserAdministrationVersion } from '../policies/user-administration-version.policy';

export type UpdateUserAdministrationInput = {
  expected_version: number;
  status_id?: string;
  role_ids?: string[];
};

@Injectable()
export class UserAdministrationService {
  public constructor(
    private readonly users: UserService,
    private readonly userRepo: UserRepository,
    private readonly references: IdentityReferenceService,
    private readonly sessions: RefreshService,
  ) {}

  public async updateUserStatusByKey(
    user: UserEntity,
    key: AccountStatusKey,
    manager: EntityManager = applicationManager(this.userRepo.manager),
  ): Promise<UserEntity> {
    if (key === ACCOUNT_STATUS_KEYS.DELETED)
      throw new BadRequestException(
        'Use account deletion to remove access and credentials.',
      );
    const status = await this.references.getAccountStatus(key, manager);
    const updated = await this.users.updateUser(
      user,
      { status: { id: status.id } },
      {},
      manager,
    );

    await this.sessions.incrementTokenVersion(user.id, manager);

    return updated;
  }

  public async addUserRoleByKey(
    user: UserEntity,
    key: ROLE_KEYS,
    manager: EntityManager = applicationManager(this.userRepo.manager),
  ): Promise<UserEntity> {
    const role = await this.references.getRole(key, manager);

    if (user.roles?.some((existingRole) => existingRole.key === role.key))
      return user;

    return this.users.updateUser(
      user,
      { roles: [...(user.roles ?? []), role] },
      {},
      manager,
    );
  }

  public async updateAdministration(
    user: UserEntity,
    input: UpdateUserAdministrationInput,
    manager: EntityManager = applicationManager(this.userRepo.manager),
  ): Promise<UserEntity> {
    return runInTransaction(manager, async (manager) => {
      if (isUserDeleted(user)) throw new NotFoundException('User not found.');
      assertUserAdministrationVersion(user, input.expected_version);
      const status = input.status_id
        ? await this.references.findStatusById(input.status_id, manager)
        : null;

      if (input.status_id && !status)
        throw new BadRequestException('Account status not found.');
      if (status?.key === ACCOUNT_STATUS_KEYS.DELETED)
        throw new BadRequestException(
          'Use account deletion to remove access and credentials.',
        );

      const roles = input.role_ids
        ? await this.references.findRolesByIds(input.role_ids, manager)
        : null;

      if (roles && roles.length !== new Set(input.role_ids).size)
        throw new BadRequestException('One or more roles were not found.');

      // Claim the expected revision before changing relations. A competing
      // administrator must fail without partially replacing roles or status.
      const revision = await this.userRepo.increment(
        manager,
        {
          id: user.id,
          administration_version: input.expected_version,
        },
        'administration_version',
        1,
      );

      if (revision.affected !== 1)
        throw new ConflictException(
          'User administration state has changed. Reload the user before retrying.',
        );
      if (status) await this.userRepo.setStatus(manager, user.id, status.id);

      if (roles)
        await this.userRepo.replaceRoles(
          manager,
          user.id,
          roles,
          user.roles ?? [],
        );

      return this.userRepo.findOneOrFail(manager, { where: { id: user.id } });
    });
  }
}
