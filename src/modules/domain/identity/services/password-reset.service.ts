import { Injectable, UnauthorizedException } from '@nestjs/common';

import { minute } from '@/common/constants/milliseconds.constants';
import { createHash, randomInt } from 'crypto';
import { EmailService } from '@/modules/system/email/services/email.service';
import { PasswordResetTemplate } from '@/modules/system/email/templates/password-reset.template';

import { UserRepository } from '../repositories/user.repository';

import { UserService } from './user.service';
import { AccountTokenService, CreatedAccountToken } from './token.service';
import { AccountTokenType } from '@/config/token.config';
import { AccountPasswordChangedTemplate } from '@/modules/system/email/templates/password-changed.template';
import { UserEntity } from '../entities/user.entity';
import { UserSessionEntity } from '../entities/session.entity';
import { ActivityAuditService } from '../../audit/services/activity-audit.service';
import { IDENTITY_AUDIT_EVENTS } from '../../audit/constants/identity-audit.constants';

const PASSWORD_RESET_CODE_EXPIRES_IN_MINUTES = 10;
const PASSWORD_RESET_AUTHORIZATION_EXPIRES_IN_MINUTES = 10;

export enum PasswordResetChallengeState {
  PENDING = 'pending',
  VERIFIED = 'verified',
  CONSUMED = 'consumed',
}

@Injectable()
export class PasswordResetService {
  public constructor(
    private readonly accountTokenSvc: AccountTokenService,
    private readonly emailSvc: EmailService,
    private readonly userRepo: UserRepository,
    private readonly userSvc: UserService,
    private readonly auditSvc: ActivityAuditService,
  ) {}

  public async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);

    if (!user) return;
    if (!this.userSvc.canAuthenticate(user)) return;

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const reset = await this.accountTokenSvc.createToken({
      user,
      type: AccountTokenType.PASSWORD_RESET,
      expiresInMs: PASSWORD_RESET_CODE_EXPIRES_IN_MINUTES * minute,
      metadata: { state: PasswordResetChallengeState.PENDING },
      mfaCodeHash: createHash('sha256').update(code).digest('hex'),
    });

    await this.emailSvc.sendEmail({
      to: user.identity.email,
      template: PasswordResetTemplate,
      model: {
        firstName: user.profile.name.preferred ?? user.profile.name.first,
        code,
        expiresInMinutes: PASSWORD_RESET_CODE_EXPIRES_IN_MINUTES,
      },
      metadata: {
        userId: user.id,
        tokenId: reset.id,
      },
    });

    await this.auditSvc.recordActivity({
      event: IDENTITY_AUDIT_EVENTS.PASSWORD_RESET_REQUESTED,
      domain: 'identity',
      outcome: 'succeeded',
      actorType: 'anonymous',
      subjectType: 'user',
      subjectId: user.id,
      resourceType: 'user',
      resourceId: user.id,
      source: 'http',
      metadata: {},
    });
  }

  public async verifyPasswordResetCode(
    email: string,
    code: string,
  ): Promise<CreatedAccountToken> {
    const user = await this.userRepo.findByEmail(email);
    if (!user || !this.userSvc.canAuthenticate(user)) {
      await this.auditSvc.recordActivity({
        event: IDENTITY_AUDIT_EVENTS.PASSWORD_RESET_CODE_REJECTED,
        domain: 'identity',
        outcome: 'failed',
        actorType: 'anonymous',
        source: 'http',
        metadata: {},
        failureCode: 'InvalidChallenge',
      });
      throw new UnauthorizedException('Invalid or expired challenge.');
    }

    try {
      const authorization = await this.accountTokenSvc.authorizeMfaCode({
        userId: user.id,
        type: AccountTokenType.PASSWORD_RESET,
        code,
        pendingMetadata: { state: PasswordResetChallengeState.PENDING },
        verifiedMetadata: { state: PasswordResetChallengeState.VERIFIED },
        expiresInMs: PASSWORD_RESET_AUTHORIZATION_EXPIRES_IN_MINUTES * minute,
      });

      await this.auditSvc.recordActivity({
        event: IDENTITY_AUDIT_EVENTS.PASSWORD_RESET_CODE_ACCEPTED,
        domain: 'identity',
        outcome: 'succeeded',
        actorType: 'anonymous',
        subjectType: 'user',
        subjectId: user.id,
        resourceType: 'user',
        resourceId: user.id,
        source: 'http',
        metadata: {},
      });

      return authorization;
    } catch (error) {
      await this.auditSvc.recordActivity({
        event: IDENTITY_AUDIT_EVENTS.PASSWORD_RESET_CODE_REJECTED,
        domain: 'identity',
        outcome: 'failed',
        actorType: 'anonymous',
        subjectType: 'user',
        subjectId: user.id,
        resourceType: 'user',
        resourceId: user.id,
        source: 'http',
        metadata: {},
        failureCode:
          error instanceof Error ? error.constructor.name : 'UnknownError',
      });

      throw error;
    }
  }

  public async confirmPasswordReset(
    tokenId: string,
    token: string,
    password: string,
  ): Promise<void> {
    const accountToken = await this.accountTokenSvc.consumeToken(
      tokenId,
      AccountTokenType.PASSWORD_RESET,
      token,
      { state: PasswordResetChallengeState.VERIFIED },
      { state: PasswordResetChallengeState.CONSUMED },
    );

    const user: UserEntity = accountToken.user;

    this.userSvc.assertCanAuthenticate(user);

    const hashed: string = await this.userSvc.hashPassword(password);

    await this.userSvc.updateUser(user, { identity: { password: hashed } });
    await this.userSvc.recordPasswordChanged(user);

    const sessionIds = (
      await this.userRepo.manager.find(UserSessionEntity, {
        where: { user: { id: user.id }, active: true },
      })
    ).map(({ id }) => id);

    await this.userRepo.revokeAllSessions(user.id);

    await this.auditSvc.recordActivity({
      event: IDENTITY_AUDIT_EVENTS.PASSWORD_RESET_COMPLETED,
      domain: 'identity',
      outcome: 'succeeded',
      actorType: 'anonymous',
      subjectType: 'user',
      subjectId: user.id,
      resourceType: 'user',
      resourceId: user.id,
      source: 'http',
      metadata: {},
    });

    await this.auditSvc.recordEntityChange({
      event: IDENTITY_AUDIT_EVENTS.PASSWORD_RESET_COMPLETED,
      domain: 'identity',
      outcome: 'succeeded',
      actorType: 'anonymous',
      subjectType: 'user',
      subjectId: user.id,
      resourceType: 'user',
      resourceId: user.id,
      source: 'http',
      metadata: {},
      before: { id: user.id },
      after: { id: user.id, identity: { password: true } },
    });

    await this.auditSvc.recordActivity({
      event: IDENTITY_AUDIT_EVENTS.ALL_SESSIONS_REVOKED,
      domain: 'identity',
      outcome: 'succeeded',
      actorType: 'anonymous',
      subjectType: 'user',
      subjectId: user.id,
      resourceType: 'user',
      resourceId: user.id,
      source: 'http',
      metadata: { session_ids: sessionIds },
    });

    await this.emailSvc.sendEmail({
      to: user.identity.email,
      template: AccountPasswordChangedTemplate,
      model: {
        firstName: user.profile.name.preferred ?? user.profile.name.first,
      },
      metadata: {
        userId: user.id,
      },
    });
  }
}
