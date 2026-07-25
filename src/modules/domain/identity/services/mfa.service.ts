import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomInt } from 'crypto';
import { Repository } from 'typeorm';

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

const MFA_CODE_EXPIRES_IN_MINUTES = 10;

@Injectable()
export class MfaService {
  public constructor(
    @InjectRepository(UserMfaSettingsEntity)
    private readonly settingsRepo: Repository<UserMfaSettingsEntity>,
    private readonly accountTokenSvc: AccountTokenService,
    private readonly emailSvc: EmailService,
  ) {}

  public async createSignInChallenge(
    user: UserEntity,
  ): Promise<CreatedAccountToken | null> {
    const settings = await this.settingsRepo.findOne({
      where: { user: { id: user.id }, enabled: true },
    });
    if (!settings) return null;

    return this.createChallenge(
      user,
      settings.primary_method,
      MfaChallengePurpose.SIGN_IN,
    );
  }

  public async requestEnable(user: UserEntity): Promise<CreatedAccountToken> {
    const current = await this.findSettings(user.id);

    if (current?.enabled)
      throw new BadRequestException('MFA is already enabled.');

    return this.createChallenge(
      user,
      MfaMethod.EMAIL_OTP,
      MfaChallengePurpose.ENABLE,
    );
  }

  public async verifyChallenge(
    challengeId: string,
    code: string,
    purpose: MfaChallengePurpose,
    userId?: string,
  ): Promise<UserEntity> {
    const token: AccountTokenEntity = await this.accountTokenSvc.consumeMfaCode(
      challengeId,
      AccountTokenType.EMAIL_MFA,
      code,
      { purpose },
      userId,
    );

    return token.user;
  }

  public async enable(user: UserEntity): Promise<void> {
    const now = new Date();
    const current = await this.findSettings(user.id);

    if (current?.enabled)
      throw new BadRequestException('MFA is already enabled.');

    await this.settingsRepo.save(
      current
        ? {
            ...current,
            enabled: true,
            primary_method: MfaMethod.EMAIL_OTP,
            enabled_at: now,
            disabled_at: null,
            last_verified_at: now,
          }
        : this.settingsRepo.create({
            user: { id: user.id },
            enabled: true,
            primary_method: MfaMethod.EMAIL_OTP,
            enabled_at: now,
            disabled_at: null,
            last_verified_at: now,
          }),
    );
  }

  public async disable(user: UserEntity): Promise<void> {
    const current = await this.findSettings(user.id);

    if (!current?.enabled)
      throw new BadRequestException('MFA is already disabled.');

    await this.settingsRepo.save({
      ...current,
      enabled: false,
      disabled_at: new Date(),
    });
    await this.accountTokenSvc.revokeActiveTokens(
      user.id,
      AccountTokenType.EMAIL_MFA,
    );
  }

  private async createChallenge(
    user: UserEntity,
    method: MfaMethod,
    purpose: MfaChallengePurpose,
  ): Promise<CreatedAccountToken> {
    if (method !== MfaMethod.EMAIL_OTP)
      throw new BadRequestException('Unsupported MFA method.');

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const token = await this.accountTokenSvc.createToken({
      user,
      type: AccountTokenType.EMAIL_MFA,
      expiresInMs: MFA_CODE_EXPIRES_IN_MINUTES * minute,
      metadata: { purpose },
      mfaCodeHash: this.hashCode(code),
    });

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

  private findSettings(userId: string): Promise<UserMfaSettingsEntity | null> {
    return this.settingsRepo.findOne({
      where: { user: { id: userId } },
    });
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}
