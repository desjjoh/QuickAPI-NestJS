import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { EmailIntentEntity } from '../entities/email-intent.entity';

@Injectable()
export class EmailIntentRepository {
  private readonly persistence: Repository<EmailIntentEntity>;
  public constructor(source: DataSource) {
    this.persistence = source.getRepository(EmailIntentEntity);
  }
  public get manager(): EntityManager {
    return this.persistence.manager;
  }
  public findDue(manager: EntityManager): Promise<EmailIntentEntity[]> {
    return manager
      .getRepository(EmailIntentEntity)
      .createQueryBuilder('intent')
      .where(
        'intent.state = :state AND intent.available_at <= :now AND intent.expires_at > :now',
        { state: 'pending', now: new Date() },
      )
      .orderBy('intent.available_at', 'ASC')
      .take(20)
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .getMany();
  }
  public findForDelivery(
    manager: EntityManager,
    id: string,
  ): Promise<EmailIntentEntity | null> {
    return manager.getRepository(EmailIntentEntity).findOne({
      where: { delivery_id: id },
      lock: { mode: 'pessimistic_write' },
    });
  }
}
