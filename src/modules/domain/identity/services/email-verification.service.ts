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
    const verification: CreatedAccountToken =
      await this.createVerificationToken(user);

    await this.sendEmail({
      user,
      to: user.identity.email,
      tokenId: verification.id,
      token: verification.token,
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

    const verification: CreatedAccountToken =
      await this.createVerificationToken(user, {
        newEmail: normalizedEmail,
      });

    await this.sendEmail({
      user,
      to: normalizedEmail,
      tokenId: verification.id,
      token: verification.token,
    });
  }

  public async sendRegistrationVerificationEmail(
    email: string,
    metadata: RegistrationTokenMetadata,
  ): Promise<void> {
    const verification: CreatedAccountToken =
      await this.registrationTokenSvc.createToken({
        email,
        expiresInMs: EMAIL_VERIFICATION_EXPIRES_IN_MINUTES * minute,
        metadata,
      });

    await this.sendEmail({
      firstName: metadata.profile.name.first,
      to: email,
      tokenId: verification.id,
      token: verification.token,
      verificationPath: '/authentication/confirm-registration',
      metadata: {
        email,
        tokenId: verification.id,
      },
    });
  }

  public async verifyEmail(tokenId: string, token: string): Promise<void> {
    const accountToken: AccountTokenEntity =
      await this.accountTokenSvc.consumeToken(
        tokenId,
        AccountTokenType.EMAIL_VERIFICATION,
        token,
      );

    const user: UserEntity | undefined = accountToken.user;

    if (!user) throw new BadRequestException('Invalid verification token.');

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
  ): Promise<CreatedAccountToken> {
    return this.accountTokenSvc.createToken({
      user,
      type: AccountTokenType.EMAIL_VERIFICATION,
      expiresInMs: EMAIL_VERIFICATION_EXPIRES_IN_MINUTES * minute,
      metadata,
    });
  }
  public async verifyRegistrationToken(
    tokenId: string,
    token: string,
  ): Promise<void> {
    const registrationToken = await this.registrationTokenSvc.consumeToken(
      tokenId,
      token,
    );

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

    await this.userSvc.updateUser(user, {
      identity: {
        ...user.identity,
        email: newEmail,
      },
    });

    await this.repo.incrementTokenVersion(user.id);
  }

  private async sendEmail({
    user,
    firstName = user?.profile.name.first ?? '',
    to,
    tokenId,
    token,
    metadata,
    verificationPath = '/authentication/verify-email',
  }: {
    user?: UserEntity;
    firstName?: string;
    to: string;
    tokenId: string;
    token: string;
    metadata?: Record<string, string>;
    verificationPath?: string;
  }): Promise<void> {
    const verificationUrl: string = this.buildVerificationUrl(
      tokenId,
      token,
      verificationPath,
    );

    await this.emailSvc.sendEmail({
      to,
      template: EmailVerificationTemplate,
      model: {
        firstName,
        verificationUrl,
        expiresInMinutes: EMAIL_VERIFICATION_EXPIRES_IN_MINUTES,
      },
      metadata: metadata ?? {
        userId: user?.id ?? '',
        tokenId,
      },
    });
  }

  private getNewEmailFromMetadata(
    metadata: Record<string, unknown> | null,
  ): string | null {
    if (!metadata) return null;

    const newEmail: unknown = metadata.newEmail;

    if (newEmail === undefined || newEmail === null) return null;

    if (typeof newEmail !== 'string' || !newEmail.trim())
      throw new BadRequestException('Invalid verification token metadata.');

    return newEmail.trim().toLowerCase();
  }

  private buildVerificationUrl(
    tokenId: string,
    token: string,
    path: string,
  ): string {
    const url: URL = new URL(path, env.PUBLIC_WEB_URL);

    url.searchParams.set('token_id', tokenId);
    url.searchParams.set('token', token);

    return url.toString();
  }
}
