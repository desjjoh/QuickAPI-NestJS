import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import {
  PaginationDto,
  PaginationMeta,
  PaginationOptions,
} from '@/common/models/pagination.model';

import { AuditEventEntity } from '../entities/audit-event.entity';
import { AuditQuery } from '../models/audit-query.model';
import {
  AuditEvent,
  AuditQueryResult,
} from '../models/audit-query-result.model';
import { AuditSort } from '@/common/models/audit.model';
import { Order } from '@/common/models/pagination.model';

const SORT_COLUMNS: Readonly<Record<AuditSort, string>> = {
  [AuditSort.OCCURRED_AT]: 'audit.occurred_at',
  [AuditSort.CREATED_AT]: 'audit.createdAt',
  [AuditSort.DOMAIN]: 'audit.domain',
  [AuditSort.EVENT]: 'audit.event',
  [AuditSort.ACTOR_TYPE]: 'audit.actor_type',
};

@Injectable()
export class AuditRepository extends Repository<AuditEventEntity> {
  public constructor(dataSource: DataSource) {
    super(AuditEventEntity, dataSource.createEntityManager());
  }

  public async findAuditById(id: string): Promise<AuditEvent | null> {
    const entity = await this.findOneBy({ id });
    return entity ? new AuditEvent(entity) : null;
  }

  public async queryAudit(query: AuditQuery): Promise<AuditQueryResult> {
    const pageOptions = Object.assign(new PaginationOptions(), {
      page: query.page ?? 1,
      take: query.take ?? 25,
    });
    this.validate(query, pageOptions);

    const builder = this.createQueryBuilder('audit');
    this.applyFilters(builder, query);
    const sort = query.sort ?? AuditSort.OCCURRED_AT;
    const order = query.order ?? Order.DESC;
    builder
      .orderBy(SORT_COLUMNS[sort], order)
      .addOrderBy('audit.id', order)
      .take(pageOptions.take)
      .skip(pageOptions.skip);

    const [entities, itemCount] = await builder.getManyAndCount();
    return new PaginationDto(
      entities.map((entity) => new AuditEvent(entity)),
      new PaginationMeta({ pageOptions, itemCount }),
    );
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

  private validate(query: AuditQuery, pageOptions: PaginationOptions): void {
    if (query.sort !== undefined && !(query.sort in SORT_COLUMNS))
      throw new BadRequestException('sort is invalid');

    if (
      query.order !== undefined &&
      !Object.values(Order).includes(query.order)
    )
      throw new BadRequestException('order is invalid');

    if (!Number.isInteger(pageOptions.page) || pageOptions.page < 1)
      throw new BadRequestException('page must be a positive integer');
    if (
      !Number.isInteger(pageOptions.take) ||
      pageOptions.take < 1 ||
      pageOptions.take > 100
    )
      throw new BadRequestException('take must be between 1 and 100');
    if (
      query.occurredFrom &&
      query.occurredTo &&
      query.occurredFrom > query.occurredTo
    )
      throw new BadRequestException('occurredFrom must not follow occurredTo');
  }
}
