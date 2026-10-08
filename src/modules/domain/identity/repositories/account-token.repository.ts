import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';

import { DomainRepository } from '@/common/repositories/domain.repository';
import { AccountTokenType } from '@/config/token.config';

import { AccountTokenEntity } from '../entities/account-token.entity';

@Injectable()
export class AccountTokenRepository extends DomainRepository<AccountTokenEntity> {
  public constructor(dataSource: DataSource) {
    super(dataSource.getRepository(AccountTokenEntity));
  }

  public findPendingById(
    manager: EntityManager,
    id: string,
    type: AccountTokenType,
  ): Promise<AccountTokenEntity | null> {
    return this.getRepository(manager).findOne({
      where: { id, type, consumed_at: IsNull() },
      relations: { user: true },
    });
  }

  public findPendingByUser(
    manager: EntityManager,
    userId: string,
    type: AccountTokenType,
  ): Promise<AccountTokenEntity | null> {
    return this.getRepository(manager).findOne({
      where: { user: { id: userId }, type, consumed_at: IsNull() },
      relations: { user: true },
    });
  }
}
