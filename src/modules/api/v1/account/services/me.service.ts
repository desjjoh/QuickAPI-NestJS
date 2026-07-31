import { Response } from 'express';

import { BadRequestException, Injectable } from '@nestjs/common';

import { UserService } from '@/modules/domain/identity/services/user.service';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';

import { UpdateEmailDto } from '../models/updateEmail.model';
import { UpdatePasswordDto } from '../models/updatePassword.model';
import { DeleteAccountDto } from '../models/deleteAccount.model';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';
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
import {
  EmailVerificationChallengeDto,
  VerifyEmailDto,
} from '../../authentication/models/verify-email.model';
import { AuditService } from '@/modules/domain/audit/services/audit.service';
import {
  AUDIT_EVENT_MATRIX,
  AuditEventDomain,
} from '@/config/audit-events.config';
import { EmailVerificationService } from '@/modules/domain/identity/services/email-verification.service';

@Injectable()
export class MeApiService {
  public constructor(
    private readonly userSvc: UserService,
    private readonly refreshSvc: RefreshService,
    private readonly evSvc: EmailVerificationService,
    private readonly emailSvc: EmailService,
    private readonly mfaSvc: MfaService,
    private readonly auditSvc: AuditService,
  ) {}

  public async deleteMe(
    user: UserEntity,
    dto: DeleteAccountDto,
    res: Response,
  ): Promise<void> {
    await this.userSvc.validateUser(user.identity.email, dto.password);

    await this.userSvc.deleteUser(user, res);
    await this.auditSvc.record({
      event: AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].ACCOUNT_DELETED,
      domain: AuditEventDomain.IDENTITY,
      outcome: 'succeeded',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'user',
      subjectId: user.id,
      resourceType: 'identity.user',
      resourceId: user.id,
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
      await this.auditSvc.record({
        event: AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].MFA_DISABLED,
        domain: AuditEventDomain.IDENTITY,
        outcome: 'succeeded',
        actorType: 'user',
        actorId: user.id,
        subjectType: 'user',
        subjectId: user.id,
        resourceType: 'identity.user',
        resourceId: user.id,
        source: 'http',
        metadata: {},
      });

      return;
    }

    const challenge = await this.mfaSvc.requestEnable(user);

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
    await this.auditSvc.record({
      event: AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].MFA_ENABLED,
      domain: AuditEventDomain.IDENTITY,
      outcome: 'succeeded',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'user',
      subjectId: user.id,
      resourceType: 'identity.user',
      resourceId: user.id,
      sessionId: currentSession.id,
      source: 'http',
      metadata: {},
    });
  }

  public async updateEmail(
    user: UserEntity,
    dto: UpdateEmailDto,
  ): Promise<EmailVerificationChallengeDto> {
    const emailChanged =
      dto.email.trim().toLowerCase() !==
      user.identity.email.trim().toLowerCase();

    if (!emailChanged)
      throw new BadRequestException(
        'New email address must be different from the current email address.',
      );

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

  public async confirmEmail(
    user: UserEntity,
    currentSession: UserSessionEntity,
    dto: VerifyEmailDto,
    res: Response,
  ): Promise<JWTDto> {
    const previousEmail = user.identity.email;
    const updated = await this.evSvc.verifyEmail(
      dto.challenge_id,
      dto.code,
      user,
    );

    const emailChanged =
      updated.identity.email.trim().toLowerCase() !==
      previousEmail.trim().toLowerCase();

    if (!emailChanged)
      throw new BadRequestException(
        'New email address must be different from the current email address.',
      );

    await this.auditSvc.record({
      event:
        AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].EMAIL_CHANGE_COMPLETED,
      domain: AuditEventDomain.IDENTITY,
      outcome: 'succeeded',
      actorType: 'user',
      actorId: updated.id,
      subjectType: 'user',
      subjectId: updated.id,
      resourceType: 'identity.user',
      resourceId: updated.id,
      sessionId: currentSession.id,
      source: 'http',
      metadata: {},
      before: { id: updated.id, identity: { email: previousEmail } },
      after: { id: updated.id, identity: { email: updated.identity.email } },
    });

    return this.refreshSvc.issueTokens(updated, res, currentSession);
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

    await this.auditSvc.record({
      event: AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].PASSWORD_CHANGED,
      domain: AuditEventDomain.IDENTITY,
      outcome: 'succeeded',
      actorType: 'user',
      actorId: updated.id,
      subjectType: 'user',
      subjectId: updated.id,
      resourceType: 'identity.user',
      resourceId: updated.id,
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
