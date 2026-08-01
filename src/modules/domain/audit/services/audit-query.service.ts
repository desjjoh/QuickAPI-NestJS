import { Injectable } from '@nestjs/common';

import { AuditQuery } from '../models/audit-query.model';
import { AuditQueryResult } from '../models/audit-query-result.model';
import { AuditRepository } from '../repositories/audit.repository';

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

  public byActor(
    actorType: string,
    actorId: string | null,
    options: QueryOptions = {},
  ): Promise<AuditQueryResult> {
    return this.query({ ...options, actorType, actorId });
  }

  public bySubject(
    subjectType: string,
    subjectId: string,
    options: QueryOptions = {},
  ): Promise<AuditQueryResult> {
    return this.query({ ...options, subjectType, subjectId });
  }

  public resourceHistory(
    resourceType: string,
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
