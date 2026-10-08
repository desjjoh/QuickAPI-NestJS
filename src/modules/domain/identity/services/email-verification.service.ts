import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { minute } from '@/common/constants/milliseconds.constants';
import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';

import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import {
  AccountTokenService,
  CreatedAccountToken,
} from '@/modules/domain/identity/services/token.service';
import { AccountTokenType } from '@/config/token.config';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { UserAdministrationService } from '@/modules/domain/identity/services/user-administration.service';
import { UserCredentialsService } from '@/modules/domain/identity/services/user-credentials.service';
import { UserLifecycleService } from '@/modules/domain/identity/services/user-lifecycle.service';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';
import { AccountTokenEntity } from '@/modules/domain/identity/entities/account-token.entity';
import { EmailService } from '@/modules/system/email/services/email.service';
import { EmailVerificationTemplate } from '@/modules/system/email/templates/email-verification.template';
import { ROLE_KEYS } from '@/modules/domain/library/seeders/role.seeder';
import { RegistrationTokenMetadata } from '@/modules/domain/identity/entities/registration-token.entity';
import { RegistrationTokenService } from '@/modules/domain/identity/services/registration-token.service';
import { EntityManager } from 'typeorm';
import { RegistrationVerificationTemplate } from '@/modules/system/email/templates/registration-verification.template';
import { RegistrationSuccessTemplate } from '@/modules/system/email/templates/registration-success.template';
import { EmailChangeSuccessTemplate } from '@/modules/system/email/templates/email-changed.template';
import { generateVerificationCode, hashIdentityToken } from './token-security';

const EMAIL_VERIFICATION_EXPIRES_IN_MINUTES = 30;

type EmailVerificationMetadata = {
  newEmail?: string;
};

@Injectable()
export class EmailVerificationService {
  public constructor(
    private readonly accountTokenSvc: AccountTokenService,
    private readonly registrationTokenSvc: RegistrationTokenService,
    private readonly userSvc: UserService,
    private readonly lifecycle: UserLifecycleService,
    private readonly administration: UserAdministrationService,
    private readonly credentials: UserCredentialsService,
    private readonly refresh: RefreshService,
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

    const existingUser = await this.userSvc.findByEmail(normalizedEmail);

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
    const { user, previousEmail } = await this.userSvc.transaction(
      async (manager: EntityManager) => {
        const accountToken: AccountTokenEntity =
          await this.accountTokenSvc.consumeMfaCode(
            challengeId,
            AccountTokenType.EMAIL_VERIFICATION,
            code,
            {},
            authenticatedUser.id,
            manager,
          );
        const tokenUser: UserEntity | undefined = accountToken.user;

        if (!tokenUser || authenticatedUser.id !== tokenUser.id)
          throw new BadRequestException('Invalid verification token.');

        const newEmail = this.getNewEmailFromMetadata(accountToken.metadata);
        if (!newEmail) {
          await this.verifyInitialEmail(tokenUser, manager);
          return { user: tokenUser, previousEmail: null };
        }

        const oldEmail = tokenUser.identity.email;
        const changed = await this.verifyEmailChange(
          tokenUser,
          newEmail,
          manager,
        );
        return { user: changed, previousEmail: oldEmail };
      },
    );

    if (previousEmail) await this.sendEmailChangeSuccess(user, previousEmail);

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

    const user = await this.userSvc.transaction((manager) =>
      this.verifyRegistration(registrationToken.metadata, manager),
    );

    await this.sendRegistrationSuccess(user);
    return user;
  }

  private async verifyRegistration(
    metadata: RegistrationTokenMetadata,
    manager: EntityManager,
  ): Promise<UserEntity> {
    return this.lifecycle.createUser(
      {
        identity: {
          email: metadata.email,
          password: metadata.password,
        },
        profile: metadata.profile,
      },
      manager,
    );
  }

  private async verifyInitialEmail(
    user: UserEntity,
    manager: EntityManager,
  ): Promise<void> {
    if (user.status?.key === ACCOUNT_STATUS_KEYS.ACTIVE) {
      await this.administration.addUserRoleByKey(user, ROLE_KEYS.USER, manager);

      return;
    }

    throw new BadRequestException('Account cannot be verified.');
  }

  private async verifyEmailChange(
    user: UserEntity,
    newEmail: string,
    manager: EntityManager,
  ): Promise<UserEntity> {
    if (!this.credentials.canAuthenticate(user))
      throw new BadRequestException('Account cannot change email address.');

    const existingUser = await this.userSvc.findByEmail(newEmail, manager);

    if (existingUser && existingUser.id !== user.id)
      throw new ConflictException(
        'A user with this email address already exists.',
      );

    const changedUser = await this.userSvc.updateUser(
      user,
      {
        identity: {
          ...user.identity,
          email: newEmail,
        },
        metadata: {
          ...user.metadata,
          last_changed_email: new Date(),
        },
      },
      {},
      manager,
    );

    await this.refresh.incrementTokenVersion(changedUser.id, manager);

    return changedUser;
  }

  private async sendEmailChangeSuccess(
    changedUser: UserEntity,
    previousEmail: string,
  ): Promise<void> {
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

  private async sendRegistrationSuccess(user: UserEntity): Promise<void> {
    await this.emailSvc.sendEmail({
      to: user.identity.email,
      template: RegistrationSuccessTemplate,
      model: {
        firstName: user.profile.name.preferred ?? user.profile.name.first,
      },
      metadata: { userId: user.id },
    });
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
    return generateVerificationCode();
  }

  private hashMfaCode(code: string): string {
    return hashIdentityToken(code);
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
