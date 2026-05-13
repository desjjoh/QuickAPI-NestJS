import { Injectable, BadRequestException } from '@nestjs/common';

import { minute } from '@/common/constants/milliseconds.constants';
import { ACCOUNT_STATUS_KEYS } from '@/config/statuses.config';

import { UserEntity } from '../entities/user.entity';
import { AccountTokenService } from './token.service';
import { AccountTokenType } from '@/config/token.config';
import { UserService } from './user.service';
import { AccountTokenEntity } from '../entities/account-token.entity';
import { EmailService } from '@/modules/system/email/services/email.service';
import { EmailVerificationTemplate } from '@/modules/system/email/templates/email-verification.template';
import { env } from '@/config/environment.config';
import { UserRepository } from '../repositories/user.repository';
import { ROLE_KEYS } from '../../library/seeders/role.seeder';

const EMAIL_VERIFICATION_EXPIRES_IN_MINUTES = 30;

@Injectable()
export class EmailVerificationService {
  public constructor(
    private readonly repo: UserRepository,
    private readonly accountTokenSvc: AccountTokenService,
    private readonly userSvc: UserService,
    private readonly emailSvc: EmailService,
  ) {}

  public async createVerificationToken(user: UserEntity) {
    return this.accountTokenSvc.createToken({
      user,
      type: AccountTokenType.EMAIL_VERIFICATION,
      expiresInMs: EMAIL_VERIFICATION_EXPIRES_IN_MINUTES * minute,
    });
  }

  public async verifyEmail(tokenId: string, token: string): Promise<void> {
    const accountToken: AccountTokenEntity =
      await this.accountTokenSvc.consumeToken(
        tokenId,
        AccountTokenType.EMAIL_VERIFICATION,
        token,
      );

    const user: UserEntity = accountToken.user;

    if (!user) throw new BadRequestException('Invalid verification token.');
    if (user.status?.key === ACCOUNT_STATUS_KEYS.ACTIVE) return;

    await this.userSvc.addUserRoleByKey(user, ROLE_KEYS.ACCOUNT_USER);

    await this.userSvc.updateUserStatusByKey(user, ACCOUNT_STATUS_KEYS.ACTIVE);
  }

  private buildVerificationUrl(tokenId: string, token: string): string {
    const url = new URL('/verify-email', env.PUBLIC_WEB_URL);

    url.searchParams.set('token_id', tokenId);
    url.searchParams.set('token', token);

    return url.toString();
  }

  public async sendVerificationEmail(user: UserEntity): Promise<void> {
    const verification = await this.accountTokenSvc.createToken({
      user,
      type: AccountTokenType.EMAIL_VERIFICATION,
      expiresInMs: EMAIL_VERIFICATION_EXPIRES_IN_MINUTES * minute,
    });

    const verificationUrl = this.buildVerificationUrl(
      verification.id,
      verification.token,
    );

    await this.emailSvc.sendEmail({
      to: user.identity.email,
      template: EmailVerificationTemplate,
      model: {
        firstName: user.profile.name.first,
        verificationUrl,
        expiresInMinutes: EMAIL_VERIFICATION_EXPIRES_IN_MINUTES,
      },
      metadata: {
        category: 'account',
        workflow: 'email-verification',
      },
    });
  }

  public async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.repo.findByEmail(email);

    if (!user) return;
    if (user.status?.key !== ACCOUNT_STATUS_KEYS.PENDING_VERIFICATION) return;

    await this.sendVerificationEmail(user);
  }
}
