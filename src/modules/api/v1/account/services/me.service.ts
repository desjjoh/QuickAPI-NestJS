import { Response } from 'express';

import { Injectable } from '@nestjs/common';

import { UserService } from '@/modules/domain/identity/services/user.service';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';

import { UpdateEmailDto } from '../models/updateEmail.model';
import { UpdatePasswordDto } from '../models/updatePassword.model';
import { DeleteAccountDto } from '../models/deleteAccount.model';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';
import { EmailVerificationService } from '@/modules/domain/identity/services/email-verification.service';
import { EmailService } from '@/modules/system/email/services/email.service';
import { AccountPasswordChangedTemplate } from '@/modules/system/email/templates/password-changed.template';
import { MfaService } from '@/modules/domain/identity/services/mfa.service';
import {
  MfaChallengeResponseDto,
  VerifyMfaChallengeDto,
} from '../../authentication/models/mfa.model';
import { UpdateMfaDto } from '../models/updateMfa.model';
import {
  MfaChallengePurpose,
  MfaMethod,
} from '@/modules/domain/identity/entities/mfa.entity';
import { UnauthorizedException } from '@nestjs/common';
import { EmailVerificationChallengeDto } from '../../authentication/models/verify-email.model';
import { ActivityAuditService } from '@/modules/domain/audit/services/activity-audit.service';
import { IDENTITY_AUDIT_EVENTS } from '@/modules/domain/audit/constants/identity-audit.constants';

@Injectable()
export class MeApiService {
  public constructor(
    private readonly userSvc: UserService,
    private readonly refreshSvc: RefreshService,
    private readonly evSvc: EmailVerificationService,
    private readonly emailSvc: EmailService,
    private readonly mfaSvc: MfaService,
    private readonly auditSvc: ActivityAuditService,
  ) {}

  public async deleteMe(
    user: UserEntity,
    dto: DeleteAccountDto,
    res: Response,
  ): Promise<void> {
    await this.userSvc.validateUser(user.identity.email, dto.password);

    await this.userSvc.deleteUser(user, res);
    await this.auditSvc.recordActivity({
      event: IDENTITY_AUDIT_EVENTS.ACCOUNT_DELETED,
      outcome: 'succeeded',
      actorType: 'user',
      actorUserId: user.id,
      subjectUserId: user.id,
      entityType: 'user',
      entityId: user.id,
      source: 'http',
      metadata: {},
    });
  }

  public async updateMfa(
    user: UserEntity,
    dto: UpdateMfaDto,
  ): Promise<MfaChallengeResponseDto | void> {
    await this.userSvc.validateUser(user.identity.email, dto.password);

    if (!dto.enabled) {
      await this.mfaSvc.disable(user);
      await this.userSvc.updateMetadata(user, { mfa_enabled: false });
      await this.auditSvc.recordActivity({
        event: IDENTITY_AUDIT_EVENTS.MFA_DISABLED,
        outcome: 'succeeded',
        actorType: 'user',
        actorUserId: user.id,
        subjectUserId: user.id,
        entityType: 'user',
        entityId: user.id,
        source: 'http',
        metadata: {},
      });

      return;
    }

    const challenge = await this.mfaSvc.requestEnable(user);
    await this.auditSvc.recordActivity({
      event: IDENTITY_AUDIT_EVENTS.MFA_ENROLLMENT_REQUESTED,
      outcome: 'succeeded',
      actorType: 'user',
      actorUserId: user.id,
      subjectUserId: user.id,
      entityType: 'user',
      entityId: user.id,
      source: 'http',
      metadata: {},
    });
    return new MfaChallengeResponseDto({
      challenge_id: challenge.id,
      method: MfaMethod.EMAIL_OTP,
      expires_at: challenge.expires_at,
    });
  }

  public async confirmMfa(
    user: UserEntity,
    currentSession: UserSessionEntity,
    dto: VerifyMfaChallengeDto,
  ): Promise<void> {
    const challengeUser = await this.mfaSvc.verifyChallenge(
      dto.challenge_id,
      dto.code,
      MfaChallengePurpose.ENABLE,
      user.id,
    );
    if (challengeUser.id !== user.id)
      throw new UnauthorizedException('Invalid MFA challenge.');

    await this.mfaSvc.enable(user);
    await this.userSvc.updateMetadata(user, { mfa_enabled: true });
    await this.refreshSvc.revokeOtherSessions(user.id, currentSession.id);
    await this.auditSvc.recordActivity({
      event: IDENTITY_AUDIT_EVENTS.MFA_ENABLED,
      outcome: 'succeeded',
      actorType: 'user',
      actorUserId: user.id,
      subjectUserId: user.id,
      entityType: 'user',
      entityId: user.id,
      sessionId: currentSession.id,
      source: 'http',
      metadata: {},
    });
  }

  public async updateEmail(
    user: UserEntity,
    dto: UpdateEmailDto,
  ): Promise<EmailVerificationChallengeDto> {
    await this.userSvc.validateUser(user.identity.email, dto.password);
    const challenge = await this.evSvc.sendEmailChangeVerification(
      user,
      dto.email,
    );

    return new EmailVerificationChallengeDto({
      challenge_id: challenge.id,
      method: MfaMethod.EMAIL_OTP,
      expires_at: challenge.expires_at,
    });
  }

  public async updatePassword(
    user: UserEntity,
    currentSession: UserSessionEntity,
    dto: UpdatePasswordDto,
    res: Response,
  ): Promise<JWTDto> {
    await this.userSvc.validateUser(user.identity.email, dto.password);

    const hashed = await this.userSvc.hashPassword(dto.confirm);

    await this.userSvc.updateUser(user, {
      identity: { password: hashed },
    });

    const updated = await this.userSvc.recordPasswordChanged(user);

    await this.auditSvc.recordActivity({
      event: IDENTITY_AUDIT_EVENTS.PASSWORD_CHANGED,
      outcome: 'succeeded',
      actorType: 'user',
      actorUserId: updated.id,
      subjectUserId: updated.id,
      entityType: 'user',
      entityId: updated.id,
      sessionId: currentSession.id,
      source: 'http',
      metadata: {},
    });
    await this.auditSvc.recordEntityChange({
      event: IDENTITY_AUDIT_EVENTS.PASSWORD_CHANGED,
      outcome: 'succeeded',
      actorType: 'user',
      actorUserId: updated.id,
      subjectUserId: updated.id,
      entityType: 'user',
      entityId: updated.id,
      sessionId: currentSession.id,
      source: 'http',
      metadata: {},
      before: { id: updated.id },
      after: { id: updated.id, identity: { password: true } },
    });

    await this.refreshSvc.revokeOtherSessions(updated.id, currentSession.id);

    await this.emailSvc.sendEmail({
      to: updated.identity.email,
      template: AccountPasswordChangedTemplate,
      model: {
        firstName: updated.profile.name.preferred ?? updated.profile.name.first,
      },
      metadata: {
        userId: updated.id,
      },
    });

    return this.refreshSvc.issueTokens(updated, res, currentSession);
  }
}
