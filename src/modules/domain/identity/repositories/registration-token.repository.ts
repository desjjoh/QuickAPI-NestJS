import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';

import { DomainRepository } from '@/common/repositories/domain.repository';

import { RegistrationTokenEntity } from '../entities/registration-token.entity';

@Injectable()
export class RegistrationTokenRepository extends DomainRepository<RegistrationTokenEntity> {
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
}
