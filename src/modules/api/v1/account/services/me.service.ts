import { Response } from 'express';

import { Injectable } from '@nestjs/common';

import { IdentityService } from '@/modules/domain/identity/services/identity.service';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';

import { UpdateEmailDto } from '../models/updateEmail.model';
import { UpdatePasswordDto } from '../models/updatePassword.model';
import { DeleteAccountDto } from '../models/deleteAccount.model';
import { UpdatePhoneDto } from '../models/updatePhone.model';

@Injectable()
export class MeApiService {
  public constructor(private readonly svc: IdentityService) {}

  public async deleteMe(
    user: UserEntity,
    dto: DeleteAccountDto,
    res: Response,
  ): Promise<void> {
    await this.svc.validateUser(user.identity.email, dto.password);

    await this.svc.deleteUser(user, res);
  }

  public async updateEmail(
    user: UserEntity,
    dto: UpdateEmailDto,
    res: Response,
  ): Promise<JWTDto> {
    await this.svc.validateUser(user.identity.email, dto.password);

    const updated = await this.svc.updateUser(user, {
      identity: { email: dto.confirm },
    });

    return this.svc.issueTokens(updated, res);
  }

  public async updatePhone(
    user: UserEntity,
    dto: UpdatePhoneDto,
    res: Response,
  ): Promise<JWTDto> {
    const updated = await this.svc.updateUser(user, {
      identity: { phone_e164: dto.phone_e164 },
    });

    return this.svc.issueTokens(updated, res);
  }

  public async updatePassword(
    user: UserEntity,
    dto: UpdatePasswordDto,
    res: Response,
  ): Promise<JWTDto> {
    await this.svc.validateUser(user.identity.email, dto.password);

    const hashed = await this.svc.hashPassword(dto.confirm);
    const updated = await this.svc.updateUser(user, {
      identity: { password: hashed },
    });

    return this.svc.issueTokens(updated, res);
  }
}
