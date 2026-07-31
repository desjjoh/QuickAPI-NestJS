import { Injectable } from '@nestjs/common';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';
import { Response } from 'express';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { SessionDto } from '@/modules/domain/identity/models/user.model';
import { AuditService } from '@/modules/domain/audit/services/audit.service';
import {
  AUDIT_EVENT_MATRIX,
  AuditEventDomain,
} from '@/config/audit-events.config';

@Injectable()
export class SessionsApiService {
  public constructor(
    private readonly refreshSvc: RefreshService,
    private readonly auditSvc: AuditService,
  ) {}

  public async findAll(user: UserEntity): Promise<SessionDto[]> {
    const sessions = await this.refreshSvc.findSessions(user.id);
    return sessions.map((session) => new SessionDto(session));
  }

  public async revoke(
    user: UserEntity,
    currentSession: UserSessionEntity,
    sessionId: string,
    res: Response,
  ): Promise<void> {
    if (currentSession.id === sessionId) {
      await this.refreshSvc.revokeTokens(currentSession, res);
    } else {
      await this.refreshSvc.revokeSessionById(user.id, sessionId);
    }

    await this.auditSvc.record({
      event: AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].SESSION_REVOKED,
      domain: AuditEventDomain.IDENTITY,
      outcome: 'succeeded',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'user',
      subjectId: user.id,
      resourceType: 'identity.session',
      resourceId: sessionId,
      sessionId,
      source: 'http',
      metadata: {},
    });
  }

  public async revokeAll(user: UserEntity, res: Response): Promise<void> {
    const sessionIds = (await this.refreshSvc.findSessions(user.id)).map(
      ({ id }) => id,
    );
    await this.refreshSvc.revokeAllSessions(user.id, res);
    await this.auditSvc.record({
      event: AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].ALL_SESSIONS_REVOKED,
      domain: AuditEventDomain.IDENTITY,
      outcome: 'succeeded',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'user',
      subjectId: user.id,
      resourceType: 'identity.user',
      resourceId: user.id,
      source: 'http',
      metadata: { session_ids: sessionIds },
    });
  }
}
