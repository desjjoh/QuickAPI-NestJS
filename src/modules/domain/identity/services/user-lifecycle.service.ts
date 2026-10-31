import { applicationManager } from '@/common/helpers/transaction.helper';
import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DeepPartial, EntityManager } from 'typeorm';

import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';
import { ROLE_KEYS } from '@/modules/domain/identity/seeders/role.seeder';
import {
  runInTransaction,
  TransactionLifecycle,
} from '@/common/helpers/transaction.helper';

import { UserEntity, createUserMetadata } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { IdentityReferenceService } from './identity-reference.service';
import { UserService } from './user.service';
import { EmailOutboxService } from '@/modules/system/email/services/email-outbox.service';
import { IdempotencyService } from '@/modules/system/idempotency/services/idempotency.service';
import { isUserDeleted } from '../policies/user-deletion.policy';
import { ImageService } from '@/modules/domain/media/services/image.service';

@Injectable()
export class UserLifecycleService {
  public constructor(
    private readonly users: UserService,
    private readonly userRepo: UserRepository,
    private readonly references: IdentityReferenceService,
    private readonly emails: EmailOutboxService,
    private readonly idempotency: IdempotencyService,
    private readonly images: ImageService,
  ) {}

  public async createUser(
    input: DeepPartial<UserEntity>,
    manager: EntityManager = applicationManager(this.userRepo.manager),
  ): Promise<UserEntity> {
    const email = input.identity?.email;

    if (!email)
      throw new InternalServerErrorException(
        'Cannot create user without an email address.',
      );

    if (await this.users.findByEmail(email, manager))
      throw new ConflictException('A user with this email already exists.');

    const [status, role] = await Promise.all([
      this.references.getAccountStatus(ACCOUNT_STATUS_KEYS.ACTIVE, manager),
      this.references.getRole(ROLE_KEYS.USER, manager),
    ]);
    const user = this.userRepo.instantiate(manager, {
      ...input,
      status: { id: status.id },
      roles: [role],
      metadata: createUserMetadata(),
    });
    const created = await this.userRepo.save(manager, user);

    return this.userRepo.findOneOrFail(manager, { where: { id: created.id } });
  }

  public async deleteUser(
    user: UserEntity,
    manager: EntityManager = applicationManager(this.userRepo.manager),
    lifecycle?: TransactionLifecycle,
  ): Promise<void> {
    if (!lifecycle)
      return runInTransaction(
        manager,
        (transactionManager, transactionLifecycle) =>
          this.deleteUser(user, transactionManager, transactionLifecycle),
      );

    const current = await this.userRepo.findOneOrFail(manager, {
      where: { id: user.id },
      lock: { mode: 'pessimistic_write' },
    });

    if (isUserDeleted(current)) throw new NotFoundException('User not found.');
    const deleted = await this.references.getAccountStatus(
      ACCOUNT_STATUS_KEYS.DELETED,
      manager,
    );

    await this.userRepo.patch(
      manager,
      { id: current.id },
      {
        // Random, non-deliverable address releases the original email without
        // exposing it or permitting a predictable-address uniqueness attack.
        identity: {
          email: `deleted-${randomUUID()}@users.invalid`,
          password: null,
        },
        metadata: { deleted_at: new Date(), mfa_enabled: false },
        status: { id: deleted.id },
        administration_version: () => '`administration_version` + 1',
      },
    );
    await this.userRepo.removeRoles(manager, current.id, current.roles ?? []);
    await this.userRepo.deleteSessions(manager, current.id);
    await this.userRepo.deleteAccountTokens(manager, current.id);
    await this.userRepo.deleteRegistrationTokens(
      manager,
      current.identity.email,
    );
    await this.userRepo.deleteMfaSettings(manager, current.id);
    await this.userRepo.deletePhonesForProfile(manager, current.profile.id);
    await this.userRepo.deleteAddressesForProfile(manager, current.profile.id);
    await this.emails.cancelForUser(
      current.id,
      current.identity.email,
      manager,
    );
    await this.idempotency.eraseUserResponses(current.id, manager);
    const avatar = current.profile.media.avatar;

    if (avatar) {
      await this.userRepo.detachAvatar(manager, current.profile.id);
      await this.images.remove(avatar, manager, lifecycle);
    }
  }
}
