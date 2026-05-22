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

const EMAIL_VERIFICATION_EXPIRES_IN_MINUTES = 30;

type EmailVerificationMetadata = {
  newEmail?: string;
};

@Injectable()
export class EmailVerificationService {
  public constructor(
    private readonly repo: UserRepository,
    private readonly accountTokenSvc: AccountTokenService,
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

  public async resendVerificationEmail(email: string): Promise<void> {
    const user: UserEntity | null = await this.repo.findByEmail(email);

    if (!user) return;
    if (user.status?.key !== ACCOUNT_STATUS_KEYS.PENDING_VERIFICATION) return;

    await this.sendVerificationEmail(user);
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

  private async verifyInitialEmail(user: UserEntity): Promise<void> {
    if (user.status?.key === ACCOUNT_STATUS_KEYS.ACTIVE) {
      await this.userSvc.addUserRoleByKey(user, ROLE_KEYS.ACCOUNT_USER);

      return;
    }

    if (user.status?.key !== ACCOUNT_STATUS_KEYS.PENDING_VERIFICATION)
      throw new BadRequestException('Account cannot be verified.');

    const updatedUser: UserEntity = await this.userSvc.updateUserStatusByKey(
      user,
      ACCOUNT_STATUS_KEYS.ACTIVE,
    );

    await this.userSvc.addUserRoleByKey(updatedUser, ROLE_KEYS.ACCOUNT_USER);
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
    to,
    tokenId,
    token,
  }: {
    user: UserEntity;
    to: string;
    tokenId: string;
    token: string;
  }): Promise<void> {
    const verificationUrl: string = this.buildVerificationUrl(tokenId, token);

    await this.emailSvc.sendEmail({
      to,
      template: EmailVerificationTemplate,
      model: {
        firstName: user.profile.name.first,
        verificationUrl,
        expiresInMinutes: EMAIL_VERIFICATION_EXPIRES_IN_MINUTES,
      },
      metadata: {
        userId: user.id,
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

  private buildVerificationUrl(tokenId: string, token: string): string {
    const url: URL = new URL('/verify-email', env.PUBLIC_WEB_URL);

    url.searchParams.set('token_id', tokenId);
    url.searchParams.set('token', token);

    return url.toString();
  }
}
