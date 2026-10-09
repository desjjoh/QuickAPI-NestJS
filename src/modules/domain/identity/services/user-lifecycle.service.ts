import { applicationManager } from '@/common/helpers/transaction.helper';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { DeepPartial, EntityManager } from 'typeorm';

import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';
import { ROLE_KEYS } from '@/modules/domain/library/seeders/role.seeder';
import { ImageService } from '@/modules/domain/media/services/image.service';
import {
  runInTransaction,
  TransactionLifecycle,
} from '@/common/helpers/transaction.helper';

import { UserEntity, createUserMetadata } from '../entities/user.entity';
import { UserProfileEntity } from '../entities/profile.entity';
import { UserRepository } from '../repositories/user.repository';
import { IdentityReferenceService } from './identity-reference.service';
import { UserService } from './user.service';

@Injectable()
export class UserLifecycleService {
  public constructor(
    private readonly users: UserService,
    private readonly userRepo: UserRepository,
    private readonly references: IdentityReferenceService,
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
    const user = manager.create(UserEntity, {
      ...input,
      status: { id: status.id },
      roles: [role],
      metadata: createUserMetadata(),
    });
    const created = await manager.save(UserEntity, user);

    return manager.findOneOrFail(UserEntity, { where: { id: created.id } });
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

    const avatar = user.profile.media.avatar;

    await manager.remove(UserEntity, user);
    await manager.delete(UserProfileEntity, { id: user.profile.id });

    if (avatar) await this.images.remove(avatar, manager, lifecycle);
  }
}
