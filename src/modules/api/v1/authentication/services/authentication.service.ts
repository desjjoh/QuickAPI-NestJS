import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { UserService } from '@/modules/domain/identity/services/user.service';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';

@Injectable()
export class AuthService {
  public constructor(
    private readonly userSvc: UserService,
    private readonly refreshSvc: RefreshService,
  ) {}

  public async signIn(user: UserEntity, res: Response): Promise<JWTDto> {
    const updated = await this.userSvc.recordSignIn(user);

    return this.refreshSvc.issueTokens(updated, res);
  }

  public async verify(user: UserEntity, res: Response): Promise<JWTDto> {
    return this.refreshSvc.issueTokens(user, res);
  }

  public async signOut(user: UserEntity, res: Response): Promise<void> {
    await this.refreshSvc.revokeTokens(user, res);
  }
}
