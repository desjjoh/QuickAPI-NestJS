import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';

import { DomainRepository } from '@/common/repositories/domain.repository';
import { AuditSort } from '@/common/models/audit.model';
import { Order, PaginationOptions } from '@/common/models/pagination.model';

import { AuditEventEntity } from '../entities/audit-event.entity';
import { AuditQuery } from '../models/audit-query.model';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import type { AuditUserRead } from '../models/audit-user.model';

const SORT_COLUMNS: Readonly<Record<AuditSort, string>> = {
  [AuditSort.OCCURRED_AT]: 'audit.occurred_at',
  [AuditSort.CREATED_AT]: 'audit.createdAt',
  // ENUM columns otherwise sort by declaration ordinal, not their text value.
  [AuditSort.DOMAIN]: 'CAST(audit.domain AS CHAR)',
  [AuditSort.EVENT]: 'audit.event',
  [AuditSort.ACTOR_TYPE]: 'CAST(audit.actor_type AS CHAR)',
};

@Injectable()
export class AuditRepository extends DomainRepository<AuditEventEntity> {
  public constructor(dataSource: DataSource) {
    super(dataSource.getRepository(AuditEventEntity));
  }

  public query(
    manager: EntityManager,
    query: AuditQuery,
    pageOptions: PaginationOptions,
    sort: AuditSort,
    order: Order,
  ): Promise<[AuditEventEntity[], number]> {
    const builder = this.getRepository(manager).createQueryBuilder('audit');

    this.applyFilters(builder, query);

    return builder
      .orderBy(SORT_COLUMNS[sort], order)
      .addOrderBy('audit.id', order)
      .take(pageOptions.take)
      .skip(pageOptions.skip)
      .getManyAndCount();
  }

  /** Batch display projection, deliberately including tombstones and no eager relations. */
  public findActorUsers(
    manager: EntityManager,
    ids: readonly string[],
  ): Promise<AuditUserRead[]> {
    if (!ids.length) return Promise.resolve([]);

    return manager
      .getRepository(UserEntity)
      .createQueryBuilder('actor')
      .innerJoin('actor.profile', 'profile')
      .innerJoin('actor.status', 'status')
      .leftJoin('profile.media.avatar', 'avatar')
      .select([
        'actor.id AS id',
        'actor.identity.email AS email',
        'profile.name.first AS first',
        'profile.name.last AS last',
        'profile.name.preferred AS preferred',
        'status.key AS status_key',
        'status.label AS status_label',
        'avatar.id AS avatar_id',
        'avatar.storage_key AS avatar_key',
      ])
      .where('actor.id IN (:...ids)', { ids })
      .getRawMany<AuditUserRead>();
  }

  private applyFilters(
    builder: SelectQueryBuilder<AuditEventEntity>,
    query: AuditQuery,
  ): void {
    const filters: ReadonlyArray<[keyof AuditQuery, string]> = [
      ['domain', 'domain'],
      ['event', 'event'],
      ['actorType', 'actor_type'],
      ['actorId', 'actor_id'],
      ['subjectType', 'subject_type'],
      ['subjectId', 'subject_id'],
      ['resourceType', 'resource_type'],
      ['resourceId', 'resource_id'],
      ['requestId', 'request_id'],
      ['sessionId', 'session_id'],
    ];

    for (const [property, column] of filters) {
      const value = query[property];

      if (value === undefined) continue;
      if (value === null) builder.andWhere(`audit.${column} IS NULL`);
      else
        builder.andWhere(`audit.${column} = :${property}`, {
          [property]: value,
        });
    }

    if (query.occurredFrom)
      builder.andWhere('audit.occurred_at >= :occurredFrom', {
        occurredFrom: query.occurredFrom,
      });
    if (query.occurredTo)
      builder.andWhere('audit.occurred_at <= :occurredTo', {
        occurredTo: query.occurredTo,
      });
  }
}
