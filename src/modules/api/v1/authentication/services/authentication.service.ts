import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';
import { UserSessionEntity } from '@/modules/domain/identity/entities/session.entity';
import { MfaService } from '@/modules/domain/identity/services/mfa.service';
import { MfaChallengePurpose } from '@/modules/domain/identity/entities/mfa.entity';
import { MfaMethod } from '@/modules/domain/identity/entities/mfa.entity';
import { MfaChallengeResponseDto } from '../models/mfa.model';

@Injectable()
export class AuthService {
  public constructor(
    private readonly userSvc: UserService,
    private readonly refreshSvc: RefreshService,
    private readonly mfaSvc: MfaService,
  ) {}

  public async signIn(
    user: UserEntity,
    res: Response,
  ): Promise<JWTDto | MfaChallengeResponseDto> {
    const challenge = await this.mfaSvc.createSignInChallenge(user);

    if (challenge)
      return new MfaChallengeResponseDto({
        challenge_id: challenge.id,
        method: MfaMethod.EMAIL_OTP,
        expires_at: challenge.expires_at,
      });

    return this.completeSignIn(user, res);
  }

  public async completeSignIn(
    user: UserEntity,
    res: Response,
  ): Promise<JWTDto> {
    const updated = await this.userSvc.recordSignIn(user);

    return this.refreshSvc.issueTokens(updated, res);
  }

  public async verifyMfa(
    challengeId: string,
    code: string,
    res: Response,
  ): Promise<JWTDto> {
    const user = await this.mfaSvc.verifyChallenge(
      challengeId,
      code,
      MfaChallengePurpose.SIGN_IN,
    );

    this.userSvc.assertCanAuthenticate(user);

    return this.completeSignIn(user, res);
  }

  public async verify(
    user: UserEntity,
    res: Response,
    session: UserSessionEntity,
  ): Promise<JWTDto> {
    return this.refreshSvc.issueTokens(user, res, session);
  }

  public async signOut(
    session: UserSessionEntity,
    res: Response,
  ): Promise<void> {
    await this.refreshSvc.revokeTokens(session, res);
  }
}
