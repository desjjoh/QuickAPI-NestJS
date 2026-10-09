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
    manager: EntityManager = this.userRepo.manager,
  ): Promise<[UserEntity[], number]> {
    return this.userRepo.paginate(manager, pageOptions);
  }

  public findByEmail(
    email: string,
    manager: EntityManager = this.userRepo.manager,
  ): Promise<UserEntity | null> {
    return this.userRepo.findByEmail(manager, email);
  }

  public async findByIdOrFail(
    id: string,
    manager: EntityManager = this.userRepo.manager,
  ): Promise<UserEntity> {
    const user = await this.userRepo.findById(manager, id);

    if (!user) throw new NotFoundException('User not found.');

    return user;
  }

  public async updateUser(
    user: UserEntity,
    dto: DeepPartial<UserEntity>,
    options: UpdateUserOptions = {},
    manager: EntityManager = this.userRepo.manager,
  ): Promise<UserEntity> {
    const shouldTouchLastUpdatedAt = options.touchLastUpdatedAt ?? true;
    const dtoMetadata = dto.metadata as
      | Partial<UserEntity['metadata']>
      | undefined;
    const metadata = shouldTouchLastUpdatedAt
      ? createUserMetadata({
          ...user.metadata,
          ...(dtoMetadata ?? {}),
          last_updated_at:
            options.lastUpdatedAt ?? dtoMetadata?.last_updated_at ?? new Date(),
        })
      : dtoMetadata;

    const detachedUser = manager.create(
      UserEntity,
      user as DeepPartial<UserEntity>,
    );
    const updatedUser = manager.merge(
      UserEntity,
      detachedUser,
      omitUndefinedDeep({
        ...dto,
        ...(metadata ? { metadata } : {}),
      }),
    );

    await manager.save(UserEntity, updatedUser);

    return manager.findOneOrFail(UserEntity, { where: { id: user.id } });
  }
}
