import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { minute } from '@/common/constants/milliseconds.constants';
import { AccountTokenType } from '@/config/token.config';
import { EmailService } from '@/modules/system/email/services/email.service';
import { MfaCodeTemplate } from '@/modules/system/email/templates/mfa-code.template';

import { AccountTokenEntity } from '../entities/account-token.entity';
import {
  MfaChallengePurpose,
  MfaMethod,
  UserMfaSettingsEntity,
} from '../entities/mfa.entity';
import { UserEntity } from '../entities/user.entity';
import { AccountTokenService, CreatedAccountToken } from './token.service';
import { MfaEnrollmentCodeTemplate } from '@/modules/system/email/templates/mfa-enrollment-code.template';
import { MfaSettingsRepository } from '../repositories/mfa-settings.repository';
import { generateVerificationCode, hashIdentityToken } from './token-security';

const MFA_CODE_EXPIRES_IN_MINUTES = 10;

@Injectable()
export class MfaService {
  public constructor(
    private readonly settingsRepo: MfaSettingsRepository,
    private readonly accountTokenSvc: AccountTokenService,
    private readonly emailSvc: EmailService,
  ) {}

  public async createSignInChallenge(
    user: UserEntity,
    manager: EntityManager = this.settingsRepo.manager,
  ): Promise<CreatedAccountToken | null> {
    const settings = await this.settingsRepo.findByUser(manager, user.id, true);
    if (!settings) return null;

    return this.createChallenge(
      user,
      settings.primary_method,
      MfaChallengePurpose.SIGN_IN,
      manager,
    );
  }

  public async requestEnable(
    user: UserEntity,
    manager: EntityManager = this.settingsRepo.manager,
  ): Promise<CreatedAccountToken> {
    const current = await this.findSettings(user.id, manager);

    if (current?.enabled)
      throw new BadRequestException('MFA is already enabled.');

    return this.createChallenge(
      user,
      MfaMethod.EMAIL_OTP,
      MfaChallengePurpose.ENABLE,
      manager,
    );
  }

  public async verifyChallenge(
    challengeId: string,
    code: string,
    purpose: MfaChallengePurpose,
    userId?: string,
    manager: EntityManager = this.settingsRepo.manager,
  ): Promise<UserEntity> {
    const token: AccountTokenEntity = await this.accountTokenSvc.consumeMfaCode(
      challengeId,
      AccountTokenType.EMAIL_MFA,
      code,
      { purpose },
      userId,
      manager,
    );

    return token.user;
  }

  public async enable(
    user: UserEntity,
    manager: EntityManager = this.settingsRepo.manager,
  ): Promise<void> {
    const now = new Date();
    const current = await this.findSettings(user.id, manager);

    if (current?.enabled)
      throw new BadRequestException('MFA is already enabled.');

    await manager.save(
      UserMfaSettingsEntity,
      current
        ? {
            ...current,
            enabled: true,
            primary_method: MfaMethod.EMAIL_OTP,
            enabled_at: now,
            disabled_at: null,
            last_verified_at: now,
          }
        : manager.create(UserMfaSettingsEntity, {
            user: { id: user.id },
            enabled: true,
            primary_method: MfaMethod.EMAIL_OTP,
            enabled_at: now,
            disabled_at: null,
            last_verified_at: now,
          }),
    );
  }

  public async disable(
    user: UserEntity,
    manager: EntityManager = this.settingsRepo.manager,
  ): Promise<void> {
    const current = await this.findSettings(user.id, manager);

    if (!current?.enabled)
      throw new BadRequestException('MFA is already disabled.');

    await manager.save(UserMfaSettingsEntity, {
      ...current,
      enabled: false,
      disabled_at: new Date(),
    });
    await this.accountTokenSvc.revokeActiveTokens(
      user.id,
      AccountTokenType.EMAIL_MFA,
      manager,
    );
  }

  private async createChallenge(
    user: UserEntity,
    method: MfaMethod,
    purpose: MfaChallengePurpose,
    manager: EntityManager,
  ): Promise<CreatedAccountToken> {
    if (method !== MfaMethod.EMAIL_OTP)
      throw new BadRequestException('Unsupported MFA method.');

    const code = generateVerificationCode();
    const token = await this.accountTokenSvc.createToken(
      {
        user,
        type: AccountTokenType.EMAIL_MFA,
        expiresInMs: MFA_CODE_EXPIRES_IN_MINUTES * minute,
        metadata: { purpose },
        mfaCodeHash: hashIdentityToken(code),
      },
      manager,
    );

    await this.emailSvc.sendEmail({
      to: user.identity.email,
      template:
        purpose === MfaChallengePurpose.ENABLE
          ? MfaEnrollmentCodeTemplate
          : MfaCodeTemplate,
      model: {
        firstName: user.profile.name.preferred ?? user.profile.name.first,
        code,
        expiresInMinutes: MFA_CODE_EXPIRES_IN_MINUTES,
      },
      metadata: { userId: user.id, challengeId: token.id, purpose },
    });

    return token;
  }

  private findSettings(
    userId: string,
    manager: EntityManager,
  ): Promise<UserMfaSettingsEntity | null> {
    return this.settingsRepo.findByUser(manager, userId);
  }
}
