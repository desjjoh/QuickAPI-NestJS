import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { minute } from '@/common/constants/milliseconds.constants';
import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';

import { UserEntity, createUserMetadata } from '../entities/user.entity';
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
import { DataSource, EntityManager } from 'typeorm';
import { RegistrationVerificationTemplate } from '@/modules/system/email/templates/registration-verification.template';
import { RegistrationSuccessTemplate } from '@/modules/system/email/templates/registration-success.template';
import { EmailChangeSuccessTemplate } from '@/modules/system/email/templates/email-changed.template';
import { UserSessionEntity } from '../entities/session.entity';
import { AccountStatusEntity } from '../../library/entities/accountstatus.entity';
import { RoleEntity } from '../../library/entities/role.entity';
import { AuditService } from '../../audit/services/audit.service';
import {
  AUDIT_EVENT_MATRIX,
  AuditEventDomain,
} from '@/config/audit-events.config';

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
    private readonly dataSource: DataSource,
    private readonly auditSvc: AuditService,
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

    await this.auditSvc.record({
      event:
        AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY]
          .EMAIL_VERIFICATION_REQUESTED,
      domain: AuditEventDomain.IDENTITY,
      outcome: 'succeeded',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'user',
      subjectId: user.id,
      resourceType: 'user',
      resourceId: user.id,
      source: 'http',
      metadata: {},
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

    await this.auditSvc.record({
      event:
        AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].EMAIL_CHANGE_REQUESTED,
      domain: AuditEventDomain.IDENTITY,
      outcome: 'succeeded',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'user',
      subjectId: user.id,
      resourceType: 'user',
      resourceId: user.id,
      source: 'http',
      metadata: {},
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
    const { user, previousEmail } = await this.dataSource.transaction(
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

    const event = previousEmail
      ? AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY].EMAIL_CHANGE_COMPLETED
      : AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY]
          .EMAIL_VERIFICATION_COMPLETED;

    await this.auditSvc.record({
      event,
      domain: AuditEventDomain.IDENTITY,
      outcome: 'succeeded',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'user',
      subjectId: user.id,
      resourceType: 'user',
      resourceId: user.id,
      source: 'http',
      metadata: {},
    });

    if (previousEmail)
      await this.auditSvc.record({
        event,
        domain: AuditEventDomain.IDENTITY,
        outcome: 'succeeded',
        actorType: 'user',
        actorId: user.id,
        subjectType: 'user',
        subjectId: user.id,
        resourceType: 'user',
        resourceId: user.id,
        source: 'http',
        metadata: {},
        before: { id: user.id, identity: { email: previousEmail } },
        after: { id: user.id, identity: { email: user.identity.email } },
      });

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
    let user: UserEntity;
    try {
      const registrationToken =
        await this.registrationTokenSvc.consumeVerificationCode(
          challengeId,
          code,
        );

      user = await this.dataSource.transaction(async (manager) => {
        const created = await this.verifyRegistration(
          registrationToken.metadata,
          manager,
        );
        await this.auditSvc.record(
          {
            event:
              AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY]
                .REGISTRATION_VERIFICATION_SUCCEEDED,
            domain: AuditEventDomain.IDENTITY,
            outcome: 'succeeded',
            actorType: 'anonymous',
            subjectType: 'user',
            subjectId: created.id,
            resourceType: 'user',
            resourceId: created.id,
            source: 'http',
            metadata: {},
          },
          manager,
        );
        return created;
      });
    } catch (error) {
      await this.auditSvc.record({
        event:
          AUDIT_EVENT_MATRIX[AuditEventDomain.IDENTITY]
            .REGISTRATION_VERIFICATION_FAILED,
        domain: AuditEventDomain.IDENTITY,
        outcome: 'failed',
        actorType: 'anonymous',
        source: 'http',
        metadata: {},
        failureCode:
          error instanceof Error ? error.constructor.name : 'UnknownError',
      });
      throw error;
    }

    await this.sendRegistrationSuccess(user);
    return user;
  }

  private async verifyRegistration(
    metadata: RegistrationTokenMetadata,
    manager: EntityManager,
  ): Promise<UserEntity> {
    const users = manager.getRepository(UserEntity);
    const existingUser = await users.findOne({
      where: { identity: { email: metadata.email } },
    });

    if (existingUser)
      throw new ConflictException(
        'A user with this email address already exists.',
      );

    const status = await manager.getRepository(AccountStatusEntity).findOne({
      where: { key: ACCOUNT_STATUS_KEYS.ACTIVE },
    });
    const role = await manager.getRepository(RoleEntity).findOne({
      where: { key: ROLE_KEYS.USER },
    });
    if (!status || !role)
      throw new BadRequestException('Account cannot be verified.');

    const user = await users.save(
      users.create({
        identity: {
          email: metadata.email,
          password: metadata.password,
        },
        profile: metadata.profile,
        status,
        roles: [role],
        metadata: createUserMetadata(),
      }),
    );

    return (await users.findOne({ where: { id: user.id } })) ?? user;
  }

  private async verifyInitialEmail(
    user: UserEntity,
    manager?: EntityManager,
  ): Promise<void> {
    if (user.status?.key === ACCOUNT_STATUS_KEYS.ACTIVE) {
      if (manager) {
        const role = await manager.getRepository(RoleEntity).findOne({
          where: { key: ROLE_KEYS.USER },
        });

        if (!role) throw new BadRequestException('Account cannot be verified.');

        if (!user.roles?.some((item) => item.key === role.key)) {
          await manager.getRepository(UserEntity).save(
            manager.getRepository(UserEntity).merge(user, {
              roles: [...(user.roles ?? []), role],
            }),
          );
        }

        return;
      }
      await this.userSvc.addUserRoleByKey(user, ROLE_KEYS.USER);

      return;
    }

    throw new BadRequestException('Account cannot be verified.');
  }

  private async verifyEmailChange(
    user: UserEntity,
    newEmail: string,
    manager?: EntityManager,
  ): Promise<UserEntity> {
    if (!this.userSvc.canAuthenticate(user))
      throw new BadRequestException('Account cannot change email address.');

    const userRepo = manager?.getRepository(UserEntity);
    const existingUser: UserEntity | null = userRepo
      ? await userRepo.findOne({ where: { identity: { email: newEmail } } })
      : await this.repo.findByEmail(newEmail);

    if (existingUser && existingUser.id !== user.id)
      throw new ConflictException(
        'A user with this email address already exists.',
      );

    const previousEmail: string = user.identity.email;

    if (manager) {
      const users = manager.getRepository(UserEntity);

      await users.update(user.id, {
        identity: { email: newEmail },
        metadata: { last_changed_email: new Date() },
      });

      await manager
        .createQueryBuilder()
        .update(UserSessionEntity)
        .set({ token_version: () => '`token_version` + 1' })
        .where('userId = :userId AND active = true', { userId: user.id })
        .execute();

      return users.findOneOrFail({ where: { id: user.id } });
    }

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
