import { Injectable } from '@nestjs/common';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';
import { Response } from 'express';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { SessionDto } from '@/modules/domain/identity/models/user.model';

@Injectable()
export class SessionsApiService {
  public constructor(private readonly refreshSvc: RefreshService) {}

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
      return;
    }

    await this.refreshSvc.revokeSessionById(user.id, sessionId);
  }
}
