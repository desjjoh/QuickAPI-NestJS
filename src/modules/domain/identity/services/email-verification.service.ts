import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { minute } from '@/common/constants/milliseconds.constants';
import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';

import { UserEntity } from '../entities/user.entity';
import { AccountTokenService, CreatedAccountToken } from './token.service';
import { AccountTokenType } from '@/config/token.config';
import { UserService } from './user.service';
import { AccountTokenEntity } from '../entities/account-token.entity';
import { EmailService } from '@/modules/system/email/services/email.service';
import { EmailVerificationTemplate } from '@/modules/system/email/templates/email-verification.template';
import { UserRepository } from '../repositories/user.repository';
import { ROLE_KEYS } from '../../library/seeders/role.seeder';
import { RegistrationTokenMetadata } from '../entities/registration-token.entity';
import { RegistrationTokenService } from './registration-token.service';
import { createHash, randomInt } from 'crypto';
import { RegistrationVerificationTemplate } from '@/modules/system/email/templates/registration-verification.template';
import { RegistrationSuccessTemplate } from '@/modules/system/email/templates/registration-success.template';
import { EmailChangeSuccessTemplate } from '@/modules/system/email/templates/email-changed.template';

const EMAIL_VERIFICATION_EXPIRES_IN_MINUTES = 30;

type EmailVerificationMetadata = {
  newEmail?: string;
};

@Injectable()
export class EmailVerificationService {
  public constructor(
    private readonly repo: UserRepository,
    private readonly accountTokenSvc: AccountTokenService,
    private readonly registrationTokenSvc: RegistrationTokenService,
    private readonly userSvc: UserService,
    private readonly emailSvc: EmailService,
  ) {}

  public async sendVerificationEmail(
    user: UserEntity,
  ): Promise<CreatedAccountToken> {
    const mfaCode: string = this.generateMfaCode();
    const verification: CreatedAccountToken =
      await this.createVerificationToken(user, null, this.hashMfaCode(mfaCode));

    await this.sendEmail({
      user,
      to: user.identity.email,
      tokenId: verification.id,
      mfaCode,
    });

    return verification;
  }

  public async sendEmailChangeVerification(
    user: UserEntity,
    newEmail: string,
  ): Promise<CreatedAccountToken> {
    const normalizedEmail: string = newEmail.trim().toLowerCase();

    if (normalizedEmail === user.identity.email.toLowerCase())
      throw new BadRequestException(
        'New email address must be different from the current email address.',
      );

    const existingUser: UserEntity | null =
      await this.repo.findByEmail(normalizedEmail);

    if (existingUser && existingUser.id !== user.id)
      throw new ConflictException(
        'A user with this email address already exists.',
      );

    const mfaCode: string = this.generateMfaCode();
    const verification: CreatedAccountToken =
      await this.createVerificationToken(
        user,
        { newEmail: normalizedEmail },
        this.hashMfaCode(mfaCode),
      );

    await this.sendEmail({
      user,
      to: normalizedEmail,
      tokenId: verification.id,
      mfaCode,
    });

    return verification;
  }

  public async sendRegistrationVerificationEmail(
    email: string,
    metadata: RegistrationTokenMetadata,
  ): Promise<CreatedAccountToken> {
    const mfaCode: string = this.generateMfaCode();
    const verification: CreatedAccountToken =
      await this.registrationTokenSvc.createToken({
        email,
        expiresInMs: EMAIL_VERIFICATION_EXPIRES_IN_MINUTES * minute,
        metadata,
        mfaCodeHash: this.hashMfaCode(mfaCode),
      });

    await this.sendEmail({
      firstName: metadata.profile.name.preferred ?? metadata.profile.name.first,
      to: email,
      tokenId: verification.id,
      mfaCode,
      template: RegistrationVerificationTemplate,
      metadata: {
        email,
        tokenId: verification.id,
      },
    });

    return verification;
  }

  public async verifyEmail(
    challengeId: string,
    code: string,
    authenticatedUser: UserEntity,
  ): Promise<UserEntity> {
    const accountToken: AccountTokenEntity =
      await this.accountTokenSvc.consumeMfaCode(
        challengeId,
        AccountTokenType.EMAIL_VERIFICATION,
        code,
        {},
      );

    const user: UserEntity | undefined = accountToken.user;

    if (!user || authenticatedUser.id !== user.id)
      throw new BadRequestException('Invalid verification token.');

    const newEmail: string | null = this.getNewEmailFromMetadata(
      accountToken.metadata,
    );

    if (newEmail) {
      return this.verifyEmailChange(user, newEmail);
    }

    await this.verifyInitialEmail(user);

    return user;
  }

  private async createVerificationToken(
    user: UserEntity,
    metadata: EmailVerificationMetadata | null = null,
    mfaCodeHash: string | null = null,
  ): Promise<CreatedAccountToken> {
    return this.accountTokenSvc.createToken({
      user,
      type: AccountTokenType.EMAIL_VERIFICATION,
      expiresInMs: EMAIL_VERIFICATION_EXPIRES_IN_MINUTES * minute,
      metadata,
      mfaCodeHash,
    });
  }

  public async verifyRegistrationToken(
    challengeId: string,
    code: string,
  ): Promise<UserEntity> {
    const registrationToken =
      await this.registrationTokenSvc.consumeVerificationCode(
        challengeId,
        code,
      );

    return this.verifyRegistration(registrationToken.metadata);
  }

  private async verifyRegistration(
    metadata: RegistrationTokenMetadata,
  ): Promise<UserEntity> {
    const existingUser: UserEntity | null = await this.repo.findByEmail(
      metadata.email,
    );

    if (existingUser)
      throw new ConflictException(
        'A user with this email address already exists.',
      );

    const user: UserEntity = await this.userSvc.createUser({
      identity: {
        email: metadata.email,
        password: metadata.password,
      },
      profile: metadata.profile,
    });

    await this.verifyInitialEmail(user);

    await this.emailSvc.sendEmail({
      to: user.identity.email,
      template: RegistrationSuccessTemplate,
      model: {
        firstName: user.profile.name.preferred ?? user.profile.name.first,
      },
      metadata: {
        userId: user.id,
      },
    });

    return user;
  }

  private async verifyInitialEmail(user: UserEntity): Promise<void> {
    if (user.status?.key === ACCOUNT_STATUS_KEYS.ACTIVE) {
      await this.userSvc.addUserRoleByKey(user, ROLE_KEYS.USER);

      return;
    }

    throw new BadRequestException('Account cannot be verified.');
  }

  private async verifyEmailChange(
    user: UserEntity,
    newEmail: string,
  ): Promise<UserEntity> {
    if (!this.userSvc.canAuthenticate(user))
      throw new BadRequestException('Account cannot change email address.');

    const existingUser: UserEntity | null =
      await this.repo.findByEmail(newEmail);

    if (existingUser && existingUser.id !== user.id)
      throw new ConflictException(
        'A user with this email address already exists.',
      );

    const previousEmail: string = user.identity.email;
    const updatedUser: UserEntity = await this.userSvc.updateUser(user, {
      identity: {
        ...user.identity,
        email: newEmail,
      },
    });

    const changedUser: UserEntity =
      await this.userSvc.recordEmailChanged(updatedUser);

    await this.repo.incrementTokenVersion(changedUser.id);

    await this.emailSvc.sendEmail({
      to: previousEmail,
      template: EmailChangeSuccessTemplate,
      model: {
        firstName:
          changedUser.profile.name.preferred ?? changedUser.profile.name.first,
        email: changedUser.identity.email,
      },
      metadata: {
        userId: changedUser.id,
      },
    });

    return changedUser;
  }

  private async sendEmail({
    user,
    firstName = user?.profile.name.preferred ?? user?.profile.name.first ?? '',
    to,
    tokenId,
    mfaCode,
    metadata,
    template = EmailVerificationTemplate,
  }: {
    user?: UserEntity;
    firstName?: string;
    to: string;
    tokenId: string;
    mfaCode: string;
    metadata?: Record<string, string>;
    template?: typeof EmailVerificationTemplate;
  }): Promise<void> {
    await this.emailSvc.sendEmail({
      to,
      template,
      model: {
        firstName,
        mfaCode,
        expiresInMinutes: EMAIL_VERIFICATION_EXPIRES_IN_MINUTES,
      },
      metadata: metadata ?? {
        userId: user?.id ?? '',
        tokenId,
      },
    });
  }

  private generateMfaCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hashMfaCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private getNewEmailFromMetadata(
    metadata: Record<string, unknown> | null,
    required = false,
  ): string | null {
    if (!metadata) {
      if (required)
        throw new BadRequestException('Invalid verification token metadata.');

      return null;
    }

    const newEmail: unknown = metadata.newEmail;

    if (newEmail === undefined || newEmail === null) {
      if (required)
        throw new BadRequestException('Invalid verification token metadata.');

      return null;
    }

    if (typeof newEmail !== 'string' || !newEmail.trim())
      throw new BadRequestException('Invalid verification token metadata.');

    return newEmail.trim().toLowerCase();
  }
}
