import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, IsNull, MoreThan, Not } from 'typeorm';

import { DomainRepository } from '@/common/repositories/domain.repository';

import { UserSessionEntity } from '../entities/session.entity';

@Injectable()
export class SessionRepository extends DomainRepository<UserSessionEntity> {
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
}
