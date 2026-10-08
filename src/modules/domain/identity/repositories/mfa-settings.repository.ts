import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { DomainRepository } from '@/common/repositories/domain.repository';

import { UserMfaSettingsEntity } from '../entities/mfa.entity';

@Injectable()
export class MfaSettingsRepository extends DomainRepository<UserMfaSettingsEntity> {
  public constructor(dataSource: DataSource) {
    super(dataSource.getRepository(UserMfaSettingsEntity));
  }

  public findByUser(
    manager: EntityManager,
    userId: string,
    enabled?: boolean,
  ): Promise<UserMfaSettingsEntity | null> {
    return this.getRepository(manager).findOne({
      where: {
        user: { id: userId },
        ...(enabled === undefined ? {} : { enabled }),
      },
    });
  }
}
