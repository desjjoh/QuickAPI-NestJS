import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { AuditActorType } from '@/config/audit-events.config';
import { AuditSort } from '@/common/models/audit.model';
import {
  Order,
  PaginationDto,
  PaginationMeta,
  PaginationOptions,
} from '@/common/models/pagination.model';

import { AuditQuery } from '../models/audit-query.model';
import {
  AuditEvent,
  AuditQueryResult,
} from '../models/audit-query-result.model';
import { AuditRepository } from '../repositories/audit.repository';
import { AuditUserDto } from '../models/audit-user.model';
import {
  AuditResourceType,
  AuditSubjectType,
} from '@/config/audit-events.config';

type QueryOptions = Omit<
  AuditQuery,
  | 'actorType'
  | 'actorId'
  | 'subjectType'
  | 'subjectId'
  | 'resourceType'
  | 'resourceId'
  | 'domain'
  | 'requestId'
  | 'sessionId'
>;

@Injectable()
export class AuditQueryService {
  public constructor(private readonly repository: AuditRepository) {}

  public async query(
    filters: AuditQuery,
    manager: EntityManager = this.repository.manager,
    options: { readonly includeActorUsers?: boolean } = {},
  ): Promise<AuditQueryResult> {
    const pageOptions = Object.assign(new PaginationOptions(), {
      page: filters.page ?? 1,
      take: filters.take ?? 25,
    });

    this.validate(filters, pageOptions);

    const [entities, itemCount] = await this.repository.query(
      manager,
      filters,
      pageOptions,
      filters.sort ?? AuditSort.OCCURRED_AT,
      filters.order ?? Order.DESC,
    );

    const actors = options.includeActorUsers
      ? await this.actorUsers(
          entities.map((entity) => entity.actor_user_id),
          manager,
        )
      : new Map<string, AuditUserDto>();

    return new PaginationDto(
      entities.map(
        (entity) =>
          new AuditEvent(
            entity,
            entity.actor_user_id
              ? (actors.get(entity.actor_user_id) ?? null)
              : null,
          ),
      ),
      new PaginationMeta({ pageOptions, itemCount }),
    );
  }

  public async findById(
    id: string,
    manager: EntityManager = this.repository.manager,
    options: { readonly includeActorUsers?: boolean } = {},
  ): Promise<AuditEvent | null> {
    const entity = await this.repository.findById(manager, id);

    if (!entity) return null;
    const actors = options.includeActorUsers
      ? await this.actorUsers([entity.actor_user_id], manager)
      : new Map<string, AuditUserDto>();

    return new AuditEvent(
      entity,
      entity.actor_user_id ? (actors.get(entity.actor_user_id) ?? null) : null,
    );
  }

  private async actorUsers(
    ids: readonly (string | null)[],
    manager: EntityManager,
  ): Promise<Map<string, AuditUserDto>> {
    const unique = [
      ...new Set(
        ids.filter(
          (id): id is string => typeof id === 'string' && id.length > 0,
        ),
      ),
    ];

    if (!unique.length) return new Map();
    const users = await this.repository.findActorUsers(manager, unique);

    return new Map(users.map((user) => [user.id, new AuditUserDto(user)]));
  }

  public byActor(
    actorType: AuditActorType,
    actorId: string | null,
    options: QueryOptions = {},
    manager: EntityManager = this.repository.manager,
  ): Promise<AuditQueryResult> {
    return this.query({ ...options, actorType, actorId }, manager);
  }

  public bySubject(
    subjectType: AuditSubjectType,
    subjectId: string,
    options: QueryOptions = {},
    manager: EntityManager = this.repository.manager,
  ): Promise<AuditQueryResult> {
    return this.query({ ...options, subjectType, subjectId }, manager);
  }

  public resourceHistory(
    resourceType: AuditResourceType,
    resourceId: string,
    options: QueryOptions = {},
    manager: EntityManager = this.repository.manager,
  ): Promise<AuditQueryResult> {
    return this.query({ ...options, resourceType, resourceId }, manager);
  }

  public byDomain(
    domain: string,
    options: QueryOptions = {},
    manager: EntityManager = this.repository.manager,
  ): Promise<AuditQueryResult> {
    return this.query({ ...options, domain }, manager);
  }

  public byRequest(
    requestId: string,
    options: QueryOptions = {},
    manager: EntityManager = this.repository.manager,
  ): Promise<AuditQueryResult> {
    return this.query({ ...options, requestId }, manager);
  }

  public bySession(
    sessionId: string,
    options: QueryOptions = {},
    manager: EntityManager = this.repository.manager,
  ): Promise<AuditQueryResult> {
    return this.query({ ...options, sessionId }, manager);
  }

  private validate(query: AuditQuery, pageOptions: PaginationOptions): void {
    if (
      query.sort !== undefined &&
      !Object.values(AuditSort).includes(query.sort)
    )
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
