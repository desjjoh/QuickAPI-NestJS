import { Response } from 'express';

import { Injectable } from '@nestjs/common';

import { UserService } from '@/modules/domain/identity/services/user.service';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';

import { UpdateEmailDto } from '../models/updateEmail.model';
import { UpdatePasswordDto } from '../models/updatePassword.model';
import { DeleteAccountDto } from '../models/deleteAccount.model';
import { RefreshService } from '@/modules/domain/identity/services/refresh.service';
import { EmailVerificationService } from '@/modules/domain/identity/services/email-verification.service';

@Injectable()
export class MeApiService {
  public constructor(
    private readonly userSvc: UserService,
    private readonly refreshSvc: RefreshService,
    private readonly evSvc: EmailVerificationService,
  ) {}

  public async deleteMe(
    user: UserEntity,
    dto: DeleteAccountDto,
    res: Response,
  ): Promise<void> {
    await this.userSvc.validateUser(user.identity.email, dto.password);

    await this.userSvc.deleteUser(user, res);
  }

  public async updateEmail(
    user: UserEntity,
    dto: UpdateEmailDto,
    res: Response,
  ): Promise<JWTDto> {
    await this.userSvc.validateUser(user.identity.email, dto.password);
    await this.evSvc.sendEmailChangeVerification(user, dto.email);

    return this.refreshSvc.issueTokens(user, res);
  }

  public async updatePassword(
    user: UserEntity,
    dto: UpdatePasswordDto,
    res: Response,
  ): Promise<JWTDto> {
    await this.userSvc.validateUser(user.identity.email, dto.password);

    const hashed = await this.userSvc.hashPassword(dto.confirm);
    await this.userSvc.updateUser(user, {
      identity: { password: hashed },
    });

    const updated = await this.userSvc.recordPasswordChanged(user);

    return this.refreshSvc.issueTokens(updated, res);
  }
}
