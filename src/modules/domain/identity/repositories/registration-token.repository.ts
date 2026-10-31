import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';

import { MutableDomainRepository } from '@/common/repositories/domain.repository';

import { RegistrationTokenEntity } from '../entities/registration-token.entity';

@Injectable()
export class RegistrationTokenRepository extends MutableDomainRepository<RegistrationTokenEntity> {
  public constructor(dataSource: DataSource) {
    super(dataSource.getRepository(RegistrationTokenEntity));
  }

  public findPendingByEmail(
    manager: EntityManager,
    email: string,
  ): Promise<RegistrationTokenEntity | null> {
    return this.getRepository(manager).findOne({
      where: { email, consumed_at: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  public findPendingById(
    manager: EntityManager,
    id: string,
  ): Promise<RegistrationTokenEntity | null> {
    return this.getRepository(manager).findOne({
      where: { id, consumed_at: IsNull() },
    });
  }

  public consumeCode(
    manager: EntityManager,
    entity: RegistrationTokenEntity,
    codeHash: string,
    consumedAt: Date,
    maxAttempts: number,
  ) {
    return manager
      .createQueryBuilder()
      .update(RegistrationTokenEntity)
      .set({ consumed_at: consumedAt })
      .where('id = :id', { id: entity.id })
      .andWhere('consumed_at IS NULL')
      .andWhere('locked_at IS NULL')
      .andWhere('failed_attempts < :maxAttempts', {
        maxAttempts: maxAttempts,
      })
      .andWhere('expires_at > :now', { now: consumedAt })
      .andWhere('mfa_code_hash = :codeHash', { codeHash })
      .execute();
  }

  public recordFailedAttempt(
    manager: EntityManager,
    id: string,
    maxAttempts: number,
  ): Promise<void> {
    return manager
      .createQueryBuilder()
      .update(RegistrationTokenEntity)
      .set({
        locked_at: () =>
          `CASE WHEN \`failed_attempts\` + 1 >= ${maxAttempts} THEN CURRENT_TIMESTAMP ELSE \`locked_at\` END`,
        failed_attempts: () => '`failed_attempts` + 1',
      })
      .where('id = :id', { id })
      .andWhere('consumed_at IS NULL')
      .andWhere('locked_at IS NULL')
      .andWhere('failed_attempts < :maxAttempts', {
        maxAttempts: maxAttempts,
      })
      .execute()
      .then(() => undefined);
  }
}
