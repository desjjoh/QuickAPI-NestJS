import { Injectable } from '@nestjs/common';

import { minute } from '@/common/constants/milliseconds.constants';
import { env } from '@/config/environment.config';
import { EmailService } from '@/modules/system/email/services/email.service';
import { PasswordResetTemplate } from '@/modules/system/email/templates/password-reset.template';

import { UserRepository } from '../repositories/user.repository';

import { UserService } from './user.service';
import { AccountTokenService } from './token.service';
import { AccountTokenType } from '@/config/token.config';

const PASSWORD_RESET_EXPIRES_IN_MINUTES = 30;

@Injectable()
export class PasswordResetService {
  public constructor(
    private readonly accountTokenSvc: AccountTokenService,
    private readonly emailSvc: EmailService,
    private readonly userRepo: UserRepository,
    private readonly userSvc: UserService,
  ) {}

  public async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);

    if (!user) return;
    if (!this.userSvc.canAuthenticate(user)) return;

    const reset = await this.accountTokenSvc.createToken({
      user,
      type: AccountTokenType.PASSWORD_RESET,
      expiresInMs: PASSWORD_RESET_EXPIRES_IN_MINUTES * minute,
    });

    const resetUrl = this.buildPasswordResetUrl(reset.id, reset.token);

    await this.emailSvc.sendEmail({
      to: user.identity.email,
      template: PasswordResetTemplate,
      model: {
        firstName: user.profile.name.first,
        resetUrl,
        expiresInMinutes: PASSWORD_RESET_EXPIRES_IN_MINUTES,
      },
      metadata: {
        userId: user.id,
        tokenId: reset.id,
      },
    });
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
    );

    const user = accountToken.user;

    const hashed: string = await this.userSvc.hashPassword(password);

    await this.userSvc.updateUser(user, { identity: { password: hashed } });

    await this.userRepo.incrementTokenVersion(user.id);
  }

  private buildPasswordResetUrl(tokenId: string, token: string): string {
    const url = new URL('/reset-password', env.PUBLIC_WEB_URL);

    url.searchParams.set('token_id', tokenId);
    url.searchParams.set('token', token);

    return url.toString();
  }
}
