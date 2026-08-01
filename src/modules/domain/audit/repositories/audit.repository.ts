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
    builder
      .orderBy('audit.occurred_at', 'DESC')
      .addOrderBy('audit.id', 'DESC')
      .take(pageOptions.take)
      .skip(pageOptions.skip);

    const [entities, itemCount] = await builder.getManyAndCount();
    return new PaginationDto(
      entities.map((entity) => new AuditEvent(entity)),
      new PaginationMeta({ pageOptions, itemCount }),
    );
  }

  public async queryActorActivity(
    actorType: string,
    actorId: string,
    query: Pick<
      AuditQuery,
      'domain' | 'event' | 'outcome' | 'occurredFrom' | 'occurredTo'
    >,
    cursor: { occurredAt: Date; id: string } | undefined,
    take: number,
  ): Promise<{ events: AuditEvent[]; hasMore: boolean }> {
    const builder = this.createQueryBuilder('audit');
    this.applyFilters(builder, { ...query, actorType, actorId });
    if (cursor) {
      builder.andWhere(
        '(audit.occurred_at < :cursorTime OR (audit.occurred_at = :cursorTime AND audit.id < :cursorId))',
        { cursorTime: cursor.occurredAt, cursorId: cursor.id },
      );
    }
    builder
      .orderBy('audit.occurred_at', 'DESC')
      .addOrderBy('audit.id', 'DESC')
      .take(take + 1);

    const entities = await builder.getMany();
    return {
      events: entities.slice(0, take).map((entity) => new AuditEvent(entity)),
      hasMore: entities.length > take,
    };
  }

  private applyFilters(
    builder: SelectQueryBuilder<AuditEventEntity>,
    query: AuditQuery,
  ): void {
    const filters: ReadonlyArray<[keyof AuditQuery, string]> = [
      ['domain', 'domain'],
      ['event', 'event'],
      ['outcome', 'outcome'],
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
