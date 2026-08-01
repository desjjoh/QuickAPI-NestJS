import { Injectable } from '@nestjs/common';

import { AuditQuery } from '../models/audit-query.model';
import { AuditQueryResult } from '../models/audit-query-result.model';
import { AuditRepository } from '../repositories/audit.repository';
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

  public query(filters: AuditQuery): Promise<AuditQueryResult> {
    return this.repository.queryAudit(filters);
  }

  public actorActivity(
    actorType: string,
    actorId: string,
    filters: Pick<
      AuditQuery,
      'domain' | 'event' | 'outcome' | 'occurredFrom' | 'occurredTo'
    >,
    cursor: { occurredAt: Date; id: string } | undefined,
    take: number,
  ) {
    return this.repository.queryActorActivity(
      actorType,
      actorId,
      filters,
      cursor,
      take,
    );
  }

  public byActor(
    actorType: string,
    actorId: string | null,
    options: QueryOptions = {},
  ): Promise<AuditQueryResult> {
    return this.query({ ...options, actorType, actorId });
  }

  public bySubject(
    subjectType: AuditSubjectType,
    subjectId: string,
    options: QueryOptions = {},
  ): Promise<AuditQueryResult> {
    return this.query({ ...options, subjectType, subjectId });
  }

  public resourceHistory(
    resourceType: AuditResourceType,
    resourceId: string,
    options: QueryOptions = {},
  ): Promise<AuditQueryResult> {
    return this.query({ ...options, resourceType, resourceId });
  }

  public byDomain(
    domain: string,
    options: QueryOptions = {},
  ): Promise<AuditQueryResult> {
    return this.query({ ...options, domain });
  }

  public byRequest(
    requestId: string,
    options: QueryOptions = {},
  ): Promise<AuditQueryResult> {
    return this.query({ ...options, requestId });
  }

  public bySession(
    sessionId: string,
    options: QueryOptions = {},
  ): Promise<AuditQueryResult> {
    return this.query({ ...options, sessionId });
  }
}
