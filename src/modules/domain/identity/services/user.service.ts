import { isUserDeleted } from '../policies/user-deletion.policy';
import { applicationManager } from '@/common/helpers/transaction.helper';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial, EntityManager } from 'typeorm';

import { omitUndefinedDeep } from '@/common/helpers/typing.helper';
import {
  runInTransaction,
  type TransactionWork,
} from '@/common/helpers/transaction.helper';

import { UserEntity, createUserMetadata } from '../entities/user.entity';
import { UserPaginationOptions } from '../models/user.model';
import { UserRepository } from '../repositories/user.repository';

type UpdateUserOptions = {
  touchLastUpdatedAt?: boolean;
  lastUpdatedAt?: Date | null;
};

@Injectable()
export class UserService {
  public constructor(private readonly userRepo: UserRepository) {}

  public transaction<T>(work: TransactionWork<T>): Promise<T> {
    return runInTransaction(this.userRepo.manager, work);
  }

  public paginate(
    pageOptions: UserPaginationOptions,
    manager: EntityManager = applicationManager(this.userRepo.manager),
  ): Promise<[UserEntity[], number]> {
    return this.userRepo.paginate(manager, pageOptions);
  }

  public findByEmail(
    email: string,
    manager: EntityManager = applicationManager(this.userRepo.manager),
  ): Promise<UserEntity | null> {
    return this.userRepo.findByEmail(manager, email);
  }

  public async findByIdOrFail(
    id: string,
    manager: EntityManager = applicationManager(this.userRepo.manager),
  ): Promise<UserEntity> {
    const user = await this.userRepo.findById(manager, id);

    if (!user) throw new NotFoundException('User not found.');

    return user;
  }

  public async updateUser(
    user: UserEntity,
    dto: DeepPartial<UserEntity>,
    options: UpdateUserOptions = {},
    manager: EntityManager = applicationManager(this.userRepo.manager),
  ): Promise<UserEntity> {
    return runInTransaction(manager, async (manager) => {
      // Serialize account mutations against soft deletion; stale request objects
      // must never reintroduce credentials or personal data into a tombstone.
      const current = await manager.findOneOrFail(UserEntity, {
        where: { id: user.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (isUserDeleted(current))
        throw new NotFoundException('User not found.');
      const shouldTouchLastUpdatedAt = options.touchLastUpdatedAt ?? true;
      const dtoMetadata = (dto.metadata ? { ...dto.metadata } : undefined) as
        | Partial<UserEntity['metadata']>
        | undefined;

      // Only the deletion lifecycle can assign this historical timestamp.
      if (dtoMetadata) Reflect.deleteProperty(dtoMetadata, 'deleted_at');
      const metadata = shouldTouchLastUpdatedAt
        ? createUserMetadata({
            ...current.metadata,
            ...(dtoMetadata ?? {}),
            last_updated_at:
              options.lastUpdatedAt ??
              dtoMetadata?.last_updated_at ??
              new Date(),
          })
        : dtoMetadata;

      const detachedUser = manager.create(
        UserEntity,
        current as DeepPartial<UserEntity>,
      );
      const updatedUser = manager.merge(
        UserEntity,
        detachedUser,
        omitUndefinedDeep({
          ...dto,
          ...(metadata ? { metadata } : {}),
        }),
      );

      // Persist only intended root fields, not stale status/roles copied from a
      // request's user object. Revision is database-owned, never caller-supplied.
      const fields = new Set([
        'id',
        ...Object.keys(omitUndefinedDeep(dto)),
        ...(metadata ? ['metadata'] : []),
      ]);

      for (const field of Object.keys(updatedUser)) {
        if (!fields.has(field) || field === 'administration_version')
          Reflect.deleteProperty(updatedUser, field);
      }

      await manager.save(UserEntity, updatedUser);
      if (dto.status !== undefined || dto.roles !== undefined) {
        await manager.increment(
          UserEntity,
          { id: user.id },
          'administration_version',
          1,
        );
      }

      return manager.findOneOrFail(UserEntity, { where: { id: user.id } });
    });
  }
}
