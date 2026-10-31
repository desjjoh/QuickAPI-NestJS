import { FindOneOptions } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, IsNull, MoreThan, Not } from 'typeorm';

import { MutableDomainRepository } from '@/common/repositories/domain.repository';

import { UserSessionEntity } from '../entities/session.entity';

@Injectable()
export class SessionRepository extends MutableDomainRepository<UserSessionEntity> {
  public constructor(dataSource: DataSource) {
    super(dataSource.getRepository(UserSessionEntity));
  }

  public findByUser(
    manager: EntityManager,
    userId: string,
    sessionId: string,
    withUser = false,
  ): Promise<UserSessionEntity | null> {
    return this.getRepository(manager).findOne({
      where: { id: sessionId, user: { id: userId } },
      ...(withUser ? { relations: { user: true } } : {}),
    });
  }

  public findActiveByUser(
    manager: EntityManager,
    userId: string,
    updatedAfter: Date,
  ): Promise<UserSessionEntity[]> {
    return this.getRepository(manager).find({
      where: {
        user: { id: userId },
        active: true,
        refresh: Not(IsNull()),
        updatedAt: MoreThan(updatedAfter),
      },
      order: { createdAt: 'DESC' },
    });
  }

  public revokeAll(manager: EntityManager, userId: string) {
    return manager
      .createQueryBuilder()
      .update(UserSessionEntity)
      .set({ active: false, refresh: null })
      .where('userId = :userId AND active = true', { userId })
      .execute();
  }

  public revokeOthers(
    manager: EntityManager,
    userId: string,
    currentSessionId: string,
  ) {
    return manager
      .createQueryBuilder()
      .update(UserSessionEntity)
      .set({ active: false, refresh: null })
      .where('userId = :userId AND id != :currentSessionId AND active = true', {
        userId,
        currentSessionId,
      })
      .execute();
  }

  public advanceTokenVersion(manager: EntityManager, userId: string) {
    return manager
      .createQueryBuilder()
      .update(UserSessionEntity)
      .set({ token_version: () => '`token_version` + 1' })
      .where('userId = :userId AND active = true', { userId })
      .execute();
  }

  public findUser(manager: EntityManager, options: FindOneOptions<UserEntity>) {
    return manager.findOne(UserEntity, options);
  }
}
