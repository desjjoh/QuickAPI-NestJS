import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuditService } from '@/modules/domain/audit/services/audit.service';
import {
  AUDIT_EVENT_MATRIX,
  AuditEventDomain,
} from '@/config/audit-events.config';
import { hashAuditIdentifier } from '@/modules/domain/audit/helpers/audit-privacy.helper';

export interface ValidationPayload {
  userEntity: UserEntity;
  email: string;
  sub: string;
}

@Injectable()
class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    private svc: UserService,
    private readonly auditSvc: AuditService,
  ) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<ValidationPayload> {
    let user: UserEntity;
    try {
      user = await this.svc.validateUser(email, password);
      this.svc.assertCanAuthenticate(user);
    } catch (error) {
      await this.auditSvc.record({
        event: AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].SIGN_IN_FAILED,
        domain: AuditEventDomain.IDENTITY,
        outcome: 'failed',
        actorType: 'anonymous',
        source: 'http',
        metadata: { identifier_hash: hashAuditIdentifier(email) },
        failureCode:
          error instanceof Error ? error.constructor.name : 'UnknownError',
      });

      throw error;
    }

    return { userEntity: user, email: user.identity.email, sub: user.id };
  }
}

export { LocalStrategy };
