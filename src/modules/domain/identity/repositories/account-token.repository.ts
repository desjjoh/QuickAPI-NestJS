import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';

import { MutableDomainRepository } from '@/common/repositories/domain.repository';
import { AccountTokenType } from '@/config/token.config';

import { AccountTokenEntity } from '../entities/account-token.entity';

@Injectable()
export class AccountTokenRepository extends MutableDomainRepository<AccountTokenEntity> {
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

  public consumeCode(
    manager: EntityManager,
    entity: AccountTokenEntity,
    type: AccountTokenType,
    consumedAt: Date,
    maxAttempts: number,
  ) {
    return manager
      .createQueryBuilder()
      .update(AccountTokenEntity)
      .set({ consumed_at: consumedAt })
      .where('id = :id', { id: entity.id })
      .andWhere('type = :type', { type })
      .andWhere('consumed_at IS NULL')
      .andWhere('locked_at IS NULL')
      .andWhere('failed_attempts < :maxAttempts', {
        maxAttempts: maxAttempts,
      })
      .andWhere('expires_at > :now', { now: consumedAt })
      .andWhere('mfa_code_hash = :codeHash', {
        codeHash: entity.mfa_code_hash,
      })
      .execute();
  }

  public async recordFailedAttempt(
    manager: EntityManager,
    id: string,
    maxAttempts: number,
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(AccountTokenEntity)
      .set({ failed_attempts: () => '`failed_attempts` + 1' })
      .where('id = :id', { id })
      .andWhere('consumed_at IS NULL')
      .andWhere('locked_at IS NULL')
      .andWhere('failed_attempts < :maxAttempts', {
        maxAttempts: maxAttempts,
      })
      .execute();

    await manager
      .createQueryBuilder()
      .update(AccountTokenEntity)
      .set({ locked_at: () => 'CURRENT_TIMESTAMP' })
      .where('id = :id', { id })
      .andWhere('consumed_at IS NULL')
      .andWhere('locked_at IS NULL')
      .andWhere('failed_attempts >= :maxAttempts', {
        maxAttempts: maxAttempts,
      })
      .execute();
  }
}
