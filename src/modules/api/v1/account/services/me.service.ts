import { Response } from 'express';

import { Injectable } from '@nestjs/common';

import { IdentityService } from '@/modules/domain/identity/services/identity.service';
import { UserEntity } from '@/modules/domain/identity/entities/user.entity';
import { JWTDto } from '@/modules/domain/identity/models/jwt.model';

import { UpdateEmailDto } from '../models/updateEmail.model';
import { UpdatePasswordDto } from '../models/updatePassword.model';
import { DeleteAccountDto } from '../models/deleteAccount.model';

@Injectable()
export class MeApiService {
  public constructor(private readonly service: IdentityService) {}

  public async deleteMe(
    user: UserEntity,
    dto: DeleteAccountDto,
    res: Response,
  ): Promise<void> {
    await this.service.validateUser(user.identity.email, dto.password);

    await this.service.deleteUser(user, res);
  }

  public async updateEmail(
    user: UserEntity,
    dto: UpdateEmailDto,
    res: Response,
  ): Promise<JWTDto> {
    await this.service.validateUser(user.identity.email, dto.password);

    const updated = await this.service.updateUser(user, {
      identity: { email: dto.confirm },
    });

    return this.service.issueTokens(updated, res);
  }

  public async updatePassword(
    user: UserEntity,
    dto: UpdatePasswordDto,
    res: Response,
  ): Promise<JWTDto> {
    await this.service.validateUser(user.identity.email, dto.password);

    const hashed = await this.service.hashPassword(dto.confirm);
    const updated = await this.service.updateUser(user, {
      identity: { password: hashed },
    });

    return this.service.issueTokens(updated, res);
  }
}
