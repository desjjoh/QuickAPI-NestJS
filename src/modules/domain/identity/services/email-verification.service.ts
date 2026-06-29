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
import { env } from '@/config/environment.config';
import { UserRepository } from '../repositories/user.repository';
import { ROLE_KEYS } from '../../library/seeders/role.seeder';
import { RegistrationTokenMetadata } from '../entities/registration-token.entity';
import { RegistrationTokenService } from './registration-token.service';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
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

  public async sendVerificationEmail(user: UserEntity): Promise<void> {
    const mfaCode: string = this.generateMfaCode();
    const verification: CreatedAccountToken =
      await this.createVerificationToken(user, null, this.hashMfaCode(mfaCode));

    await this.sendEmail({
      user,
      to: user.identity.email,
      tokenId: verification.id,
      token: verification.token,
      mfaCode,
    });
  }

  public async sendEmailChangeVerification(
    user: UserEntity,
    newEmail: string,
  ): Promise<void> {
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
      token: verification.token,
      mfaCode,
      verificationPath: '/authentication/verity-email',
      verificationType: 'email-change',
    });
  }

  public async sendRegistrationVerificationEmail(
    email: string,
    metadata: RegistrationTokenMetadata,
  ): Promise<void> {
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
      token: verification.token,
      mfaCode,
      verificationPath: '/authentication/verity-email',
      verificationType: 'register',

      template: RegistrationVerificationTemplate,
      metadata: {
        email,
        tokenId: verification.id,
      },
    });
  }

  public async validateEmailChangeToken(
    tokenId: string,
    token: string,
  ): Promise<void> {
    const accountToken: AccountTokenEntity =
      await this.accountTokenSvc.validateToken(
        tokenId,
        AccountTokenType.EMAIL_VERIFICATION,
        token,
      );

    this.getNewEmailFromMetadata(accountToken.metadata, true);
  }

  public async verifyEmail(
    tokenId: string,
    token: string,
    mfaCode: string,
  ): Promise<void> {
    const accountToken: AccountTokenEntity =
      await this.accountTokenSvc.validateToken(
        tokenId,
        AccountTokenType.EMAIL_VERIFICATION,
        token,
      );

    const user: UserEntity | undefined = accountToken.user;

    if (!user) throw new BadRequestException('Invalid verification token.');

    this.assertValidMfaCode(accountToken.mfa_code_hash, mfaCode);

    await this.accountTokenSvc.consumeToken(
      tokenId,
      AccountTokenType.EMAIL_VERIFICATION,
      token,
    );

    const newEmail: string | null = this.getNewEmailFromMetadata(
      accountToken.metadata,
    );

    if (newEmail) {
      await this.verifyEmailChange(user, newEmail);

      return;
    }

    await this.verifyInitialEmail(user);
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
    tokenId: string,
    token: string,
    mfaCode: string,
  ): Promise<void> {
    const registrationToken = await this.registrationTokenSvc.validateToken(
      tokenId,
      token,
    );

    this.assertValidMfaCode(registrationToken.mfa_code_hash, mfaCode);

    await this.registrationTokenSvc.consumeToken(tokenId, token);

    await this.verifyRegistration(registrationToken.metadata);
  }

  private async verifyRegistration(
    metadata: RegistrationTokenMetadata,
  ): Promise<void> {
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
  ): Promise<void> {
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
  }

  private async sendEmail({
    user,
    firstName = user?.profile.name.preferred ?? user?.profile.name.first ?? '',
    to,
    tokenId,
    token,
    mfaCode,
    metadata,
    verificationPath = '/authentication/verify-email',
    verificationType,
    template = EmailVerificationTemplate,
  }: {
    user?: UserEntity;
    firstName?: string;
    to: string;
    tokenId: string;
    token: string;
    mfaCode: string;
    metadata?: Record<string, string>;
    verificationPath?: string;
    verificationType?: 'register' | 'email-change';
    template?: typeof EmailVerificationTemplate;
  }): Promise<void> {
    const verificationUrl: string = this.buildVerificationUrl(
      tokenId,
      token,
      verificationPath,
      verificationType,
    );

    await this.emailSvc.sendEmail({
      to,
      template,
      model: {
        firstName,
        verificationUrl,
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

  private assertValidMfaCode(
    expectedCodeHash: string | null,
    code: string,
  ): void {
    if (!expectedCodeHash || !/^\d{6}$/.test(code))
      throw new BadRequestException('Invalid verification code.');

    const expectedBuffer = Buffer.from(expectedCodeHash, 'hex');
    const actualBuffer = Buffer.from(this.hashMfaCode(code), 'hex');

    if (expectedBuffer.length !== actualBuffer.length)
      throw new BadRequestException('Invalid verification code.');

    const isMatch = timingSafeEqual(expectedBuffer, actualBuffer);

    if (!isMatch) throw new BadRequestException('Invalid verification code.');
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

  private buildVerificationUrl(
    tokenId: string,
    token: string,
    path: string,
    type?: 'register' | 'email-change',
  ): string {
    const url: URL = new URL(path, env.PUBLIC_WEB_URL);

    url.searchParams.set('token_id', tokenId);
    url.searchParams.set('token', token);

    if (type) url.searchParams.set('type', type);

    return url.toString();
  }
}
