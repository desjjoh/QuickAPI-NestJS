import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

import { AuditEventEntity } from '../entities/audit-event.entity';
import { AuditQuery } from '../models/audit-query.model';
import {
  AuditEvent,
  AuditQueryResult,
} from '../models/audit-query-result.model';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class AuditRepository extends Repository<AuditEventEntity> {
  public constructor(dataSource: DataSource) {
    super(AuditEventEntity, dataSource.createEntityManager());
  }

  public async queryAudit(query: AuditQuery): Promise<AuditQueryResult> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const offset = query.offset ?? 0;
    this.validate(query, limit, offset);

    const builder = this.createQueryBuilder('audit');
    this.applyFilters(builder, query);
    builder
      .orderBy('audit.occurred_at', 'DESC')
      .addOrderBy('audit.id', 'DESC')
      .take(limit)
      .skip(offset);

    const [entities, total] = await builder.getManyAndCount();
    return new AuditQueryResult(
      entities.map((entity) => new AuditEvent(entity)),
      total,
      limit,
      offset,
    );
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

  private validate(query: AuditQuery, limit: number, offset: number): void {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT)
      throw new BadRequestException(`limit must be between 1 and ${MAX_LIMIT}`);
    if (!Number.isInteger(offset) || offset < 0)
      throw new BadRequestException('offset must be a non-negative integer');
    if (
      query.occurredFrom &&
      query.occurredTo &&
      query.occurredFrom > query.occurredTo
    )
      throw new BadRequestException('occurredFrom must not follow occurredTo');
  }
}
